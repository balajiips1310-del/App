# ============================================================
# CELL 1: Imports
# ============================================================

import json
import traceback
from datetime import datetime
from pyspark.sql import functions as F

# ============================================================
# CELL 2: Parameters
# ============================================================

export_config = "ABC"
table_name = ""

# ============================================================
# CELL 3: Global Config
# ============================================================

STORAGE_ACCOUNT = "upssynapsedev"
CONTAINER_NAME = "segment-exports"

# ============================================================
# CELL 4: Helpers
# ============================================================

def safe_json(value):
    try:
        if value and value != "null":
            return json.loads(value)
        return None
    except:
        return None

# ============================================================
# CELL 5: Main Execution Function
# ============================================================

def main():
    try:
        print("Starting MAIN execution")

        # ====================================================
        # PHASE 1: PARSE CONFIG
        # ====================================================
        try:
            print("🔧 [PHASE 1] Parsing config...")

            config = json.loads(export_config)

            export_id          = config.get("ExportId")
            export_name        = config.get("ExportName")
            segment_id         = config.get("SegmentId")
            export_type        = config.get("ExportType")
            watermark_column   = config.get("WatermarkColumn")
            target_source      = config.get("TargetSource")
            target_identifier  = config.get("TargetIdentifier")
            filters_json       = config.get("FiltersJson")
            filter_logic       = config.get("FilterLogic")
            column_mappings    = config.get("ColumnMappingsJson")
            static_metadata    = config.get("StaticMetadataJson")
            last_exported_at   = config.get("LastExportedAt")

            print(f" Config parsed: {export_name}")

        except Exception as e:
            print("[PHASE 1 FAILED]")
            raise Exception(f"CONFIG_PARSE: {str(e)}")


        # ====================================================
        # PHASE 2: READ DATA
        # ====================================================
        try:
            print("[PHASE 2] Reading data...")

            df = spark.table(table_name)

            print("Data loaded")

        except Exception as e:
            print("[PHASE 2 FAILED]")
            raise Exception(f"READ_DATA: {str(e)}")


        # ====================================================
        # PHASE 3: INCREMENTAL FILTER
        # ====================================================
        try:
            print("[PHASE 3] Incremental filtering...")

            if export_type == "Incremental" and watermark_column and last_exported_at:
                df = df.filter(F.col(watermark_column) > F.lit(last_exported_at))

            print("Incremental filter applied")

        except Exception as e:
            print("[PHASE 3 FAILED]")
            raise Exception(f"INCREMENTAL_FILTER: {str(e)}")


        # ====================================================
        # PHASE 4: APPLY FILTERS
        # ====================================================
        try:
            print("[PHASE 4] Applying filters...")

            filters = safe_json(filters_json)

            if filters:
                conditions = []

                for f_item in filters:
                    col_name = f_item.get("column")
                    operator = f_item.get("operator")
                    value    = f_item.get("value")

                    if operator == "equals":
                        conditions.append(F.col(col_name) == value)
                    elif operator == "not equals":
                        conditions.append(F.col(col_name) != value)
                    elif operator == "contains":
                        conditions.append(F.col(col_name).contains(value))
                    elif operator == "starts with":
                        conditions.append(F.col(col_name).startswith(value))
                    elif operator == "is empty":
                        conditions.append(F.col(col_name).isNull() | (F.col(col_name) == ""))
                    elif operator == "is not empty":
                        conditions.append(F.col(col_name).isNotNull() & (F.col(col_name) != ""))
                    elif operator == "is in":
                        values = [v.strip() for v in str(value).split(",")]
                        conditions.append(F.col(col_name).isin(values))
                    elif operator in (">", ">=", "<", "<=", "=", "!="):
                        conditions.append(F.expr(f"`{col_name}` {operator} '{value}'"))
                    elif operator == "between":
                        vals = [v.strip() for v in str(value).split(",")]
                        conditions.append(F.col(col_name).between(vals[0], vals[1]))

                if conditions:
                    combined = conditions[0]
                    for c in conditions[1:]:
                        combined = combined & c if filter_logic != "Or" else combined | c

                    df = df.filter(combined)

            print("Filters applied")

        except Exception as e:
            print("[PHASE 4 FAILED]")
            raise Exception(f"FILTERING: {str(e)}")


        # ====================================================
        # PHASE 5: COLUMN MAPPING
        # ====================================================
        try:
            print("[PHASE 5] Column mapping...")

            mappings = safe_json(column_mappings)
            select_exprs = []

            if mappings:
                for m in mappings:
                    src = m.get("sourceColumn")
                    tgt = m.get("targetColumn")
                    transform = m.get("transform", "None")

                    if transform == "None":
                        select_exprs.append(F.col(src).alias(tgt))
                    elif transform == "Trim":
                        select_exprs.append(F.trim(F.col(src)).alias(tgt))
                    elif transform == "Upper":
                        select_exprs.append(F.upper(F.col(src)).alias(tgt))
                    elif transform == "Lower":
                        select_exprs.append(F.lower(F.col(src)).alias(tgt))
                    elif transform == "SHA256":
                        select_exprs.append(F.sha2(F.col(src).cast("string"), 256).alias(tgt))
                    elif transform == "MD5":
                        select_exprs.append(F.md5(F.col(src).cast("string")).alias(tgt))
                    elif transform.startswith("Format:"):
                        fmt = transform.split(":", 1)[1]
                        select_exprs.append(F.date_format(F.col(src), fmt).alias(tgt))

            df_export = df.select(select_exprs) if select_exprs else df

            print("Column mapping applied")

        except Exception as e:
            print("[PHASE 5 FAILED]")
            raise Exception(f"COLUMN_MAPPING: {str(e)}")


        # ====================================================
        # PHASE 6: STATIC METADATA
        # ====================================================
        try:
            print("[PHASE 6] Static metadata...")

            statics = safe_json(static_metadata)

            if statics:
                for s in statics:
                    df_export = df_export.withColumn(
                        s.get("destinationColumn"),
                        F.lit(s.get("staticValue"))
                    )

            print("Static metadata added")

        except Exception as e:
            print("[PHASE 6 FAILED]")
            raise Exception(f"STATIC_METADATA: {str(e)}")


        # ====================================================
        # PHASE 7: WRITE OUTPUT
        # ====================================================
        try:
            print("[PHASE 7] Writing output...")

            timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")

            blob_path = f"segment-exports/{target_source}/{target_identifier}/{export_name}_{timestamp}"

            output_path = f"abfss://{CONTAINER_NAME}@{STORAGE_ACCOUNT}.dfs.core.windows.net/{blob_path}"

            df_export.coalesce(1).write \
                .option("header", "true") \
                .mode("overwrite") \
                .csv(output_path)

            print(f"Written to: {output_path}")

        except Exception as e:
            print("[PHASE 7 FAILED]")
            raise Exception(f"WRITE_OUTPUT: {str(e)}")


        # ====================================================
        # PHASE 8: FINAL OUTPUT
        # ====================================================
        try:
            print("[PHASE 8] Preparing result...")

            file_size = 0

            try:
                files = dbutils.fs.ls(output_path)
                csv_files = [f for f in files if f.name.endswith(".csv")]
                if csv_files:
                    file_size = csv_files[0].size
            except:
                pass

            result = {
                "status": "SUCCESS",
                "total_records": df_export.count(),
                "file_size_bytes": file_size,
                "blob_path": blob_path
            }

            print("Export Completed")

            return result

        except Exception as e:
            print("[PHASE 8 FAILED]")
            raise Exception(f"FINAL_RESPONSE: {str(e)}")


    except Exception as e:
        print("MAIN FAILED")
        print(str(e))
        print(traceback.format_exc())

        return {
            "status": "FAILED",
            "error": str(e)
        }

# ============================================================
# CELL 6: Execute
# ============================================================

try:
    print("Executing main()...")

    result = main()

    mssparkutils.notebook.exit(json.dumps(result))
    
except Exception as e:

    # Synapse throws a Py4JJavaError after notebook.exit()
    msg = str(e)

    # If our JSON already exists in the exception → notebook already exited correctly
    if '"SUCCESS"' in msg:
        raise


    mssparkutils.notebook.exit(json.dumps({
        "status": "FAILED",
        "error": str(e)
    }))


