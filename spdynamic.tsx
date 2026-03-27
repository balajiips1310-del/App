  import React, { useState, useEffect, useCallback } from 'react';
import { Filter24Regular, Dismiss24Regular } from "@fluentui/react-icons";
import { useNavigate } from 'react-router-dom';
import { useChat } from '@/contexts/ChatContext';
import {
  Card,
  Text,
  Input,
  Button,
  Tooltip ,
  Table,
  TableHeader,
  TableRow,
  TableHeaderCell,
  TableBody,
  TableCell,
  TableCellLayout,
  Dropdown,
  Option,
  Spinner,
    Drawer,
  DrawerHeader,
  DrawerHeaderTitle,
  DrawerBody,
  DrawerFooter,
} from '@fluentui/react-components';
import {
  Popover,
  PopoverTrigger,
  PopoverSurface,
} from "@fluentui/react-components";

import {
  Search24Regular,
  Add24Regular,
  Play20Regular,
  Checkmark20Regular,
  ArrowRepeatAll20Regular,
  ChevronLeft24Regular,
  ChevronRight24Regular,
  ArrowUp16Regular,
  ArrowDown16Regular,
  DocumentSearch24Regular,
  Pause20Regular,
  Drafts20Regular,
  CalendarClock20Regular,
} from '@fluentui/react-icons';
import { formatDateTime, formatDate } from '@/data/sampleData';
import { SegmentState, SegmentCycle, SegmentListItem } from '@/types/segment';
import { segmentService } from '@/services/segmentService';
import '@/styles/SegmentsPage.css';

// type SortField = 'name' | 'state' | 'nextScheduledDateTime' | 'cycle' | 'audiencesCount' | 'startDate' | 'endDate';
type SortField = string;
type SortDirection = 'asc' | 'desc';

export const SegmentsPage: React.FC = () => {
  const navigate = useNavigate();
  const { clearChat } = useChat();
  const [searchQuery, setSearchQuery] = useState('');
  const [stateFilter, setStateFilter] = useState<SegmentState | 'All'>('All');
  const [cycleFilter, setCycleFilter] = useState<SegmentCycle | 'All'>('All');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  
  // API state
  const [segments, setSegments] = useState<SegmentListItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);


const [dynamicFilters, setDynamicFilters] = useState<Record<string, any[]>>({});//changes
const [selectedFilters, setSelectedFilters] = useState<Record<string, string>>({});


const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
const [isColumnPanelOpen, setIsColumnPanelOpen] = useState(false);
const [availableColumns, setAvailableColumns] = useState<string[]>([]);
const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
const [tempSelectedColumns, setTempSelectedColumns] = useState<string[]>([]);
const [tempSelectedFilters, setTempSelectedFilters] = useState<string[]>([]);
const [filterSearchQuery, setFilterSearchQuery] = useState("");
const [dateRange, setDateRange] = useState({
  from: "",
  to: ""
});

const isDateTimeColumn = (col: string) =>
  col.toLowerCase().includes("time");

const isDateColumn = (col: string) =>
  col.toLowerCase().includes("date") && !isDateTimeColumn(col);

useEffect(() => {
  const savedColumns = localStorage.getItem("selectedColumns");
  const savedFilters = localStorage.getItem("selectedFilters");
  const savedDateRange = localStorage.getItem("dateRange");

  if (savedColumns) {
    setSelectedColumns(JSON.parse(savedColumns));
  }

  if (savedFilters) {
    setSelectedFilters(JSON.parse(savedFilters));
  }

  if (savedDateRange) {
    setDateRange(JSON.parse(savedDateRange));
  }
}, []);

  // Fetch segments from API
  const fetchSegments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await segmentService.getList({
        search: searchQuery || undefined,
        state: stateFilter !== 'All' ? stateFilter : undefined,
        cycle: cycleFilter !== 'All' ? cycleFilter : undefined,
        sortBy: sortField,
        sortDirection,
        page: currentPage,
        pageSize,
      });
      setSegments(response.items);
      setTotalCount(response.totalCount);
    } catch (err: any) {
      setError(err.message || 'Failed to load segments');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, stateFilter, cycleFilter, sortField, sortDirection, currentPage, pageSize]);

  // useEffect(() => {
  //   fetchSegments();
  // }, [fetchSegments]);

  useEffect(() => {
  fetchSegments();
}, [fetchSegments]);

useEffect(() => {
  if (segments.length > 0) {
    const filters = generateDynamicFilters(segments);
    setDynamicFilters(filters);

const keys = new Set<string>();

segments.forEach((item) => {
  Object.keys(item).forEach((k) => {
    if (k !== "id") keys.add(k);
  });
});

setAvailableColumns(Array.from(keys));
  }
}, [segments]);
// useEffect(() => {
//   setSelectedColumns(["state", "cycle", "createdBy"]);
// }, []);
useEffect(() => {
  if (availableColumns.length > 0 && selectedColumns.length === 0) {
    const defaultCols = [
      "name",
      "description",
      "state",
      "nextScheduledDateTime",
      "cycle",
      "audiencesCount",
      "recurrence",
    ];

    setSelectedColumns(defaultCols.filter(col => availableColumns.includes(col)));
  }
}, [availableColumns]);
//changes
  const EXCLUDED_COLUMNS = ["name", "description", "id", "isRunning", "startDate", "endDate" ];

const getFilterableColumns = (data: any[]) => {
  if (!data || data.length === 0) return [];

  return Object.keys(data[0]).filter(
    (key) => !EXCLUDED_COLUMNS.includes(key)
  );
};

const generateDynamicFilters = (data: any[]) => {
  const columns = getFilterableColumns(data);

  const filters: Record<string, any[]> = {};

  columns.forEach((col) => {
    filters[col] = [...new Set(data.map((item) => item[col]).filter(Boolean))];
  });

  return filters;
};
//-----
const filteredSegments = segments.filter((row) => {
  return Object.keys(selectedFilters).every((col) => {
    const filterValue = selectedFilters[col];
    if (!filterValue) return true;

    const cellValue = row[col];

    // ✅ DATE ONLY (ignore time)
if (isDateColumn(col)) {
  const cellDate = new Date(cellValue);
  const filterDate = new Date(filterValue);

  return (
    cellDate.getFullYear() === filterDate.getFullYear() &&
    cellDate.getMonth() === filterDate.getMonth() &&
    cellDate.getDate() === filterDate.getDate()
  );
}

// ✅ DATETIME (full comparison)
if (isDateTimeColumn(col)) {
  return new Date(cellValue).getTime() === new Date(filterValue).getTime();
}

    return cellValue === filterValue;
  });
})
.filter((row) => {
  if (!dateRange.from && !dateRange.to) return true;

  const rowDate = new Date(row.startDate || row.endDate);
if (isNaN(rowDate.getTime())) return false;
  rowDate.setHours(0, 0, 0, 0);

  if (dateRange.from) {
    const fromDate = new Date(dateRange.from);
    fromDate.setHours(0, 0, 0, 0);

    if (rowDate < fromDate) return false;
  }

  if (dateRange.to) {
    const toDate = new Date(dateRange.to);
    toDate.setHours(23, 59, 59, 999);

    if (rowDate > toDate) return false;
  }

  return true; // ✅ THIS WAS MISSING
});
const allColumns = React.useMemo(() => {
  if (!segments || segments.length === 0) return [];

  const keys = new Set<string>();

  segments.forEach((item) => {
    Object.keys(item).forEach((k) => {
      if (k !== "id") keys.add(k);
    });
  });

  return Array.from(keys);
}, [segments]); 

const columnsToRender =
  selectedColumns.length > 0 ? selectedColumns : allColumns;

  // Client-side sorting for the combined data
  // const sortedSegments = [...filteredSegments].sort((a, b) => {
  //   let aValue: string | number | null = null;
  //   let bValue: string | number | null = null;

  //   switch (sortField) {
  //     case 'name':
  //       aValue = a.name.toLowerCase();
  //       bValue = b.name.toLowerCase();
  //       break;
  //     case 'state':
  //       aValue = a.state;
  //       bValue = b.state;
  //       break;
  //     case 'nextScheduledDateTime':
  //       aValue = a.nextScheduledDateTime || '';
  //       bValue = b.nextScheduledDateTime || '';
  //       break;
  //     case 'cycle':
  //       aValue = a.cycle;
  //       bValue = b.cycle;
  //       break;
  //     case 'audiencesCount':
  //       aValue = a.audiencesCount;
  //       bValue = b.audiencesCount;
  //       break;
  //     case 'startDate':
  //       aValue = a.startDate || '';
  //       bValue = b.startDate || '';
  //       break;
  //     case 'endDate':
  //       aValue = a.endDate || '';
  //       bValue = b.endDate || '';
  //       break;
  //   }

  //   if (aValue === null || bValue === null) return 0;
  //   if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
  //   if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
  //   return 0;
  // });
  const sortedSegments = [...filteredSegments].sort((a, b) => {
  const aValue = (a as any)[sortField];
  const bValue = (b as any)[sortField];

  if (aValue == null || bValue == null) return 0;

  if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
  if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;

  return 0;
});

  const totalPages = Math.ceil(totalCount / pageSize);
  const startIndex = (currentPage - 1) * pageSize;

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handlePageChange = (direction: 'prev' | 'next') => {
    if (direction === 'prev' && currentPage > 1) {
      setCurrentPage(currentPage - 1);
    } else if (direction === 'next' && currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePageSizeChange = (_: unknown, data: { optionValue?: string }) => {
    if (data.optionValue) {
      setPageSize(parseInt(data.optionValue, 10));
      setCurrentPage(1);
    }
  };

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? <ArrowUp16Regular /> : <ArrowDown16Regular />;
  };

  const renderStateBadge = (state: SegmentState) => (
    <span className="status-badge">
      <span className="status-badge-icon">
        {state === 'Active' ? <Play20Regular /> : 
         state === 'Paused' ? <Pause20Regular /> :
         state === 'Draft' ? <Drafts20Regular /> :
         <Checkmark20Regular />}
      </span>
      {state}
    </span>
  );

  const renderCycleBadge = (cycle: SegmentCycle) => (
    <span className="cycle-badge">
      <span className="cycle-badge-icon">
        {cycle === 'Adhoc' ? <CalendarClock20Regular /> : <ArrowRepeatAll20Regular />}
      </span>
      {cycle}
    </span>
  );

  const handleSegmentClick = (segmentId: string) => {
    navigate(`/segments/${segmentId}`);
  };
  console.log("dynamicFilters:", dynamicFilters);
  return (
    <div className="segments-page">
    <div className="segments-page-header">
  <Text
    as="h1"
    size={700}
    weight="semibold"
    className="segments-page-title"
  >
    Segments
  </Text>

  <div className="segments-header-actions">
  

{/* <Button
  appearance="subtle"
  icon={<Filter24Regular />}
  onClick={() => {
    setFilterSearchQuery("");
    setTempSelectedColumns(
      selectedColumns.length ? selectedColumns : availableColumns
    );
    setIsColumnPanelOpen(true);
  }}
/>

<Button
  appearance="subtle"
  icon={<Add24Regular />}
  onClick={() => {
    setFilterSearchQuery("");
    setTempSelectedFilters(Object.keys(selectedFilters));
    setIsFilterPanelOpen(true);
  }}
/> */}

   <Button
      appearance="primary"
      icon={<Add24Regular />}
      onClick={() => {
        clearChat();
        navigate('/segments/create');
      }}
    >
      Create Segment
    </Button>
  </div>
</div>
<div className="segments-filters">
  
  <Tooltip content="Edit Columns" relationship="label">
 <Button
  appearance="subtle"
  icon={< Add24Regular />}
  onClick={() => {
    setFilterSearchQuery("");
    setTempSelectedColumns(
      selectedColumns.length ? selectedColumns : availableColumns
    );
    setIsColumnPanelOpen(true);
  }}
/>   
  
    </Tooltip>
    

  <Tooltip content="Add Filters" relationship="label">
  <Button
  appearance="subtle"
  icon={<Filter24Regular />}
  onClick={() => {
    setFilterSearchQuery("");
    setTempSelectedFilters(Object.keys(selectedFilters));
    setIsFilterPanelOpen(true);
  }}
/>  
</Tooltip>

  <Input
    className="segments-search"
    placeholder="Search by name or description..."
    contentBefore={<Search24Regular />}
    value={searchQuery}
    onChange={(_, data) => {
      setSearchQuery(data.value);
      setCurrentPage(1);
    }}
  />
</div>

     {/* ✅ FILTER CHIPS UI */}
<div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "8px" }}>

  {/* DATE CHIP */}
  {(tempSelectedFilters.includes("dateRange") || dateRange.from || dateRange.to) && (
    <Popover positioning={{ position: "below", align: "start" }}>
      <PopoverTrigger disableButtonEnhancement>
        <Button
  appearance="outline"
  // onClick={(e) => e.stopPropagation()}
>
  Schedule Range | {dateRange.from || "?"} → {dateRange.to || "?"}

  <span
    style={{ marginLeft: "6px", cursor: "pointer" }}
    onClick={(e) => {
      e.stopPropagation();
      const cleared = { from: "", to: "" };
      setDateRange(cleared);
      localStorage.setItem("dateRange", JSON.stringify(cleared));
    }}
  >
    ✕
  </span>
</Button>
      </PopoverTrigger>

      <PopoverSurface
  style={{
    padding: "12px",
    minWidth: "260px",
    maxWidth: "400px",
    width: "auto"
  }}
>
        <Text weight="semibold">Filter by Date</Text>

        <Input
          type="date"
          style={{ width: "100%" }}
          value={dateRange.from}
          onChange={(_, d) =>
            setDateRange((prev) => ({ ...prev, from: d.value }))
          }
        />

        <Input
          type="date"
          style={{ width: "100%" }}
          value={dateRange.to}
          style={{ marginTop: "8px" }}
          onChange={(_, d) =>
            setDateRange((prev) => ({ ...prev, to: d.value }))
          }
        />

        {/* <Button
          appearance="primary"
          style={{ marginTop: "10px", width: "100%" }}
          onClick={() => {
            localStorage.setItem("dateRange", JSON.stringify(dateRange));
          }}
        >
          Apply
        </Button> */}
      </PopoverSurface>
    </Popover>
  )}

  {/* OTHER FILTER CHIPS */}
  {Object.keys(selectedFilters).map((col) => {
    const value = selectedFilters[col];
    

    return (
      <Popover key={col}>
        <PopoverTrigger disableButtonEnhancement>
        <Button
  appearance="outline"
  // onClick={(e) => e.stopPropagation()}
>
  {col} | {value}

  <span
    style={{ marginLeft: "6px", cursor: "pointer" }}
    onClick={(e) => {
  e.stopPropagation();

  setSelectedFilters((prev) => {
    const updated = {
      ...prev,
      [col]: ""
    };

    localStorage.setItem("selectedFilters", JSON.stringify(updated));
    return updated;
  });
}}
  >
    ✕
  </span>
</Button>
        </PopoverTrigger>

        <PopoverSurface
  style={{
    padding: "12px",
    width: "260px",
    overflow: "hidden"
  }}
>
          <Text weight="semibold">Filter by {col}</Text>
          <Input
  placeholder="Search values..."
  value={filterSearchQuery}
  onChange={(_, d) => setFilterSearchQuery(d.value)}
  style={{ marginTop: "8px", marginBottom: "8px" }}
/>
{/* ✅ DATE FILTER */}
{isDateColumn(col) && (
  <Input
    type="date"
    style={{ width: "100%" }}
    value={value || ""}
    onChange={(_, d) => {
      setSelectedFilters((prev) => ({
        ...prev,
        [col]: d.value,
      }));
    }}
  />
)}
{/* ✅ DATETIME FILTER */}
{isDateTimeColumn(col) && (
  <Input
    type="datetime-local"
    value={value || ""}
    onChange={(_, d) => {
      setSelectedFilters((prev) => ({
        ...prev,
        [col]: d.value,
      }));
    }}
  />
)}

{/* ✅ NORMAL FILTER */}
{!isDateColumn(col) && !isDateTimeColumn(col) &&
  dynamicFilters[col]
  ?.filter((val) =>
    val.toString().toLowerCase().includes(filterSearchQuery.toLowerCase())
  )
  .map((val) => (
    <div key={val} style={{ marginTop: "6px" }}>
      <input
        type="radio"
        checked={value === val}
        onChange={() => {
          setSelectedFilters((prev) => ({
            ...prev,
            [col]: val,
          }));
        }}
      />
      <span
  style={{
    marginLeft: "6px",
    display: "inline-block",
    maxWidth: "300px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap"
  }}
  title={val}
>
  {val}
</span>
    </div>
  ))}

          {/* <Button
            appearance="primary"
            style={{ marginTop: "10px", width: "100%" }}
            onClick={() => {
              localStorage.setItem(
                "selectedFilters",
                JSON.stringify(selectedFilters)
              );
            }}
          >
            Apply
          </Button> */}
        </PopoverSurface>
      </Popover>
    );
  })}

</div>
      <Card className="segments-table-container" style={{ overflowX: 'auto',width: "100%" }}>
        {loading ? (
          <div className="loading-state">
            <Spinner size="large" label="Loading segments..." />
          </div>
        ) : error ? (
          <div className="error-state">
            <Text size={400}>{error}</Text>
            <Button appearance="primary" onClick={fetchSegments}>
              Retry
            </Button>
          </div>
        ) : sortedSegments.length > 0 ? (
          <>
            <Table className="segments-table" aria-label="Segments list" style={{
      tableLayout: "auto"
}}>
              {/* <TableHeader>
                <TableRow>
                  <TableHeaderCell>
                    <span className="sortable-header" onClick={() => handleSort('name')}>
                      Name
                      <span className="sort-icon">{renderSortIcon('name')}</span>
                    </span>
                  </TableHeaderCell>
                  <TableHeaderCell>Description</TableHeaderCell>
                  <TableHeaderCell>
                    <span className="sortable-header" onClick={() => handleSort('state')}>
                      State
                      <span className="sort-icon">{renderSortIcon('state')}</span>
                    </span>
                  </TableHeaderCell>
                  <TableHeaderCell>
                    <span className="sortable-header" onClick={() => handleSort('nextScheduledDateTime')}>
                      Next Scheduled
                      <span className="sort-icon">{renderSortIcon('nextScheduledDateTime')}</span>
                    </span>
                  </TableHeaderCell>
                  <TableHeaderCell>
                    <span className="sortable-header" onClick={() => handleSort('cycle')}>
                      Cycle
                      <span className="sort-icon">{renderSortIcon('cycle')}</span>
                    </span>
                  </TableHeaderCell>
                  <TableHeaderCell>
                    <span className="sortable-header" onClick={() => handleSort('audiencesCount')}>
                      Audiences
                      <span className="sort-icon">{renderSortIcon('audiencesCount')}</span>
                    </span>
                  </TableHeaderCell>
                  <TableHeaderCell>
                    <span className="sortable-header" onClick={() => handleSort('startDate')}>
                      Start Date
                      <span className="sort-icon">{renderSortIcon('startDate')}</span>
                    </span>
                  </TableHeaderCell>
                  <TableHeaderCell>
                    <span className="sortable-header" onClick={() => handleSort('endDate')}>
                      End Date
                      <span className="sort-icon">{renderSortIcon('endDate')}</span>
                    </span>
                  </TableHeaderCell>
                </TableRow>
              </TableHeader> */}
              <TableHeader>
  <TableRow>
    {columnsToRender.map((key) => (
     <TableHeaderCell
  key={key}
  style={{
    maxWidth:
      key === "name"
        ? "220px"
        : key === "description"
        ? "260px"
        : "120px",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis"
  }}
>
 <span
  className="sortable-header"
  onClick={() => handleSort(key)}
  style={{
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: "4px",
    fontWeight: "600"   
  }}
>
         {
  key === "nextScheduledDateTime"
    ? "Next Scheduled"
    : key
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (s) => s.toUpperCase())
}
          <span className="sort-icon">
            {renderSortIcon(key)}
          </span>
        </span>
      </TableHeaderCell>
    ))}
  </TableRow>
</TableHeader>
              <TableBody>
  {sortedSegments.map((segment) => (
    <TableRow key={segment.id}>
      {columnsToRender.map((key) => (
        <TableCell key={key}>
<TableCellLayout
  style={{
    maxWidth:
      key === "name"
        ? "220px"
        : key === "description"
        ? "260px"
        : "120px",
    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis"
  }}
>
{/*  
    {key === "name" ? (
    <span
      className="segment-name-cell"
      onClick={() => handleSegmentClick(segment.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          handleSegmentClick(segment.id);
        }
      }}
      role="button"
      tabIndex={0}
      style={{
        cursor: "pointer",
        color: "#0f6cbd",
        fontWeight: 500,
      }}
    >
      {segment.name}
    </span>
  ) : key === "state" ? (
    renderStateBadge(segment.state)
  ) : key === "cycle" ? (
    renderCycleBadge(segment.cycle)
  ) : key.toLowerCase().includes("date") ? (
    formatDate((segment as any)[key])
  ) : (
<span
  style={{
    display: "inline-block",
    maxWidth:
      key === "name"
        ? "220px"
        : key === "description"
        ? "260px"
        : "120px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap"
  }}
>
  {(segment as any)[key]?.toString() || "-"}
</span>
  )} */}
 {key === "name" ? (
  <Tooltip content={segment.name} relationship="label">
    <span
      className="segment-name-cell"
      onClick={() => handleSegmentClick(segment.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          handleSegmentClick(segment.id);
        }
      }}
      role="button"
      tabIndex={0}
      style={{
        cursor: "pointer",
        color: "#0f6cbd",
        fontWeight: 500,
        display: "inline-block",
        maxWidth: "220px",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap"
      }}
    >
      {segment.name}
    </span>
  </Tooltip>
) : key === "state" ? (
  renderStateBadge(segment.state)
) : key === "cycle" ? (
  renderCycleBadge(segment.cycle)
) : (() => {
  let displayValue = "";

  if (key.toLowerCase().includes("date")) {
    displayValue = formatDate((segment as any)[key]);
  } else {
    displayValue = (segment as any)[key]?.toString() || "-";
  }

  return (
    <Tooltip content={displayValue} relationship="label">
      <span
        style={{
          display: "inline-block",
          maxWidth:
            key === "description"
              ? "260px"
              : "120px",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {displayValue}
      </span>
    </Tooltip>
  );
})()}
</TableCellLayout>
        </TableCell>
      ))}
    </TableRow>
  ))}
</TableBody>
            </Table>

            <div className="segments-pagination">
              <span className="pagination-info">
                Showing {startIndex + 1}-{Math.min(startIndex + pageSize, totalCount)} of{' '}
                {totalCount}
              </span>

              <div className="pagination-controls">
                <Button
                  appearance="subtle"
                  icon={<ChevronLeft24Regular />}
                  disabled={currentPage === 1}
                  onClick={() => handlePageChange('prev')}
                  aria-label="Previous page"
                />
                <Text>
                  Page {currentPage} of {totalPages || 1}
                </Text>
                <Button
                  appearance="subtle"
                  icon={<ChevronRight24Regular />}
                  disabled={currentPage === totalPages || totalPages === 0}
                  onClick={() => handlePageChange('next')}
                  aria-label="Next page"
                />
              </div>

              <div className="page-size-selector">
                <span className="page-size-label">Items per page:</span>
                <Dropdown
                  value={pageSize.toString()}
                  onOptionSelect={handlePageSizeChange}
                  style={{ minWidth: '80px' }}
                >
                  <Option value="10">10</Option>
                  <Option value="25">25</Option>
                  <Option value="50">50</Option>
                  <Option value="100">100</Option>
                </Dropdown>
              </div>
            </div>
          </>
        ) : (
          <div className="empty-state">
            <DocumentSearch24Regular className="empty-state-icon" style={{ fontSize: '48px' }} />
            <Text size={400} className="empty-state-text">
              {(searchQuery || Object.values(selectedFilters).some(v => v))
                ? 'No segments match your filters.'
                : 'No segments created yet.'}
            </Text>
            {(!searchQuery && !Object.values(selectedFilters).some(v => v)) && (
              <Button
                appearance="primary"
                icon={<Add24Regular />}
                onClick={() => {
                  clearChat();
                  navigate('/segments/create');
                }}
              >
                Create Your First Segment
              </Button>
            )}
          </div>
        )}
      </Card>
  <Drawer
  open={isFilterPanelOpen}
  position="end"
    modalType="modal"  
  onOpenChange={(_, data) => setIsFilterPanelOpen(data.open)}
  style={{ width: "320px" }}
>
<DrawerHeader
  style={{
    borderBottom: "1px solid #eee",
    paddingBottom: "12px"
  }}
>
  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
    
    {/* Left side: Icon + Title */}
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <Filter24Regular />
      <Text weight="semibold">Select Filters</Text>
    </div>

    {/* Right side: Close button */}
    <Button
      appearance="subtle"
      icon={<Dismiss24Regular />}
      onClick={() => setIsFilterPanelOpen(false)}
    />
  </div>

  {/* Subtitle */}
  <Text size={300} style={{ marginTop: "6px", color: "#666" }}>
    Select which filters to display in your table.
  </Text>
</DrawerHeader>
  <DrawerBody style={{ overflowY: "auto", maxHeight: "100%" }}>

    {/* 🔍 Search */}
<Input
  placeholder="Search filters..."
  value={filterSearchQuery}
  onChange={(_, data) => setFilterSearchQuery(data.value)}
  style={{ marginBottom: "16px" }}
/>

    {/* ✅ Filter list */}
    {[
  ...Object.keys(dynamicFilters)
    .filter((col) => col !== "startDate" && col !== "endDate"),
  "dateRange" 
]
      .filter((col) =>
        col.toLowerCase().includes(filterSearchQuery.toLowerCase())
      )
      .map((col) => (
 <div
  key={col}
  style={{
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "6px 8px",
    borderRadius: "4px",
    cursor: "pointer"
  }}
  onMouseEnter={(e) => (e.currentTarget.style.background = "#f3f2f1")}
  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
>
          <input
            type="checkbox"
            checked={tempSelectedFilters.includes(col)}
            onChange={(e) => {
  if (e.target.checked) {
    setTempSelectedFilters((prev) =>
      prev.includes(col) ? prev : [...prev, col]
    );
  } else {
    setTempSelectedFilters((prev) =>
      prev.filter((c) => c !== col)
    );
  }
}}
          />
<Text size={400}>
  {col === "dateRange"
    ? "Schedule Range"
    : col.replace(/([A-Z])/g, " $1").replace(/^./, str => str.toUpperCase())}
</Text>
        </div>
      ))}
  </DrawerBody>

  <DrawerFooter
  style={{
    borderTop: "1px solid #eee",
    paddingTop: "12px",
    display: "flex",
    justifyContent: "flex-end",
    gap: "8px"
  }}
>
    <Button
      appearance="primary"
  onClick={() => {
  const updated: Record<string, string> = {};

  tempSelectedFilters.forEach((key) => {
    // ✅ NO DEFAULT VALUE
    updated[key] = selectedFilters[key] || "";
  });

  setSelectedFilters(updated);
  // ✅ handle dateRange selection
if (tempSelectedFilters.includes("dateRange")) {
  localStorage.setItem("dateRange", JSON.stringify(dateRange));
}

  localStorage.setItem("selectedFilters", JSON.stringify(updated));

  setIsFilterPanelOpen(false);
}}
    >
      Apply
    </Button>

    <Button onClick={() => setIsFilterPanelOpen(false)}>
      Cancel
    </Button>
  </DrawerFooter>
</Drawer>
<Drawer
  open={isColumnPanelOpen}
  position="end"
  modalType="modal"
  onOpenChange={(_, data) => setIsColumnPanelOpen(data.open)}
  style={{ width: "320px" }}
>
  {/* Header */}
  <DrawerHeader
    style={{
      borderBottom: "1px solid #eee",
      paddingBottom: "12px"
    }}
  >
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <Filter24Regular />
        <Text weight="semibold">Select Columns</Text>
      </div>

      <Button
        appearance="subtle"
        icon={<Dismiss24Regular />}
        onClick={() => setIsColumnPanelOpen(false)}
      />
    </div>

    <Text size={300} style={{ marginTop: "6px", color: "#666" }}>
      Select which columns to display in your table.
    </Text>
  </DrawerHeader>

  {/* Body */}
  <DrawerBody style={{ overflowY: "auto", maxHeight: "100%" }}>

    {/* Search */}
    <Input
      placeholder="Search columns..."
      value={filterSearchQuery}
      onChange={(_, data) => setFilterSearchQuery(data.value)}
      style={{ marginBottom: "16px" }}
    />

    {/* Column list */}
    {availableColumns
      .filter((col) =>
        col.toLowerCase().includes(filterSearchQuery.toLowerCase())
      )
      .map((col) => (
        <div
          key={col}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "6px 8px",
            borderRadius: "4px",
            cursor: "pointer"
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#f3f2f1")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        >
          <input
            type="checkbox"
            checked={tempSelectedColumns.includes(col)}
            onChange={(e) => {
              if (e.target.checked) {
                setTempSelectedColumns((prev) =>
                  prev.includes(col) ? prev : [...prev, col]
                );
              } else {
                setTempSelectedColumns((prev) =>
                  prev.filter((c) => c !== col)
                );
              }
            }}
          />

          <Text>
            {col.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase())}
          </Text>
        </div>
      ))}
  </DrawerBody>

  {/* Footer */}
  <DrawerFooter
    style={{
      borderTop: "1px solid #eee",
      paddingTop: "12px",
      display: "flex",
      justifyContent: "flex-end",
      gap: "8px"
    }}
  >
    <Button
      appearance="primary"
      onClick={() => {
        setSelectedColumns(tempSelectedColumns);
localStorage.setItem("selectedColumns", JSON.stringify(tempSelectedColumns));
        setIsColumnPanelOpen(false);
      }}
    >
      Apply
    </Button>

    <Button onClick={() => setIsColumnPanelOpen(false)}>
      Cancel
    </Button>
  </DrawerFooter>
</Drawer>
    </div>
  );
};
