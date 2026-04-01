import React, { useState, useEffect, useCallback } from 'react';
import { FilterRegular, Dismiss24Regular } from "@fluentui/react-icons";
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
  Tab,
  TabList,
  Drawer,
  DrawerHeader,
  DrawerBody,
  DrawerFooter,
} from '@fluentui/react-components';
import { useAuth } from '@/contexts/AuthContext';


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
import { formatDate } from '@/data/sampleData';
import { SegmentState, SegmentCycle, SegmentListItem } from '@/types/segment';
import { segmentService } from '@/services/segmentService';
import '@/styles/SegmentsPage.css';


type SortField = string;
type SortDirection = 'asc' | 'desc';

type SegmentTab = 'my' | 'all';

export const SegmentsPage: React.FC = () => {
  const navigate = useNavigate();
  const { clearChat } = useChat();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<SegmentTab>('my');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  
  // API state
  const [segments, setSegments] = useState<SegmentListItem[]>([]);
  const [_totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);



const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
const [isColumnPanelOpen, setIsColumnPanelOpen] = useState(false);
const [availableColumns, setAvailableColumns] = useState<string[]>([]);
const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
const [tempSelectedColumns, setTempSelectedColumns] = useState<string[]>([]);

const [filterSearchQuery, setFilterSearchQuery] = useState("");

const [filters, setFilters] = useState({
  state: [] as string[],
  cycle: [] as string[],
  recurrence: [] as string[],
  createdBy: [] as string[],
});
  const filterKeys =
  activeTab === "my"
    ? (["state", "cycle", "recurrence"] as const)
    : (["state", "cycle", "recurrence", "createdBy"] as const);

const [filterSearch, setFilterSearch] = useState({
  state: "",
  cycle: "",
  recurrence: "",
  createdBy: "",
});
const filterOptions = React.useMemo(() => {
  const getUnique = (key: string) =>
    [...new Set(segments.map((s: any) => s[key]).filter(Boolean))];

  return {
    state: getUnique("state"),
    cycle: getUnique("cycle"),
    recurrence: getUnique("recurrence"),
    createdBy: getUnique("createdBy"),
  };
}, [segments]);
useEffect(() => {
  const savedColumns = localStorage.getItem("selectedColumns");

  if (savedColumns) {
    setSelectedColumns(JSON.parse(savedColumns));
  }

}, []);

  // Fetch segments from API
  const fetchSegments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await segmentService.getList({
        search: searchQuery || undefined,
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
  }, [searchQuery, sortField, sortDirection, currentPage, pageSize]);



  useEffect(() => 
    {
    fetchSegments();
    }, [fetchSegments]);



  // Filter segments by tab (My Segments vs All Segments)
  const filteredByTab = segments.filter(segment => {
    if (activeTab === 'my') {
      // My Segments: created by current user
      return segment.createdBy?.toLowerCase() === user?.email?.toLowerCase();
    } else {
      // All Segments: all other segments (not created by me)
      return segment.createdBy?.toLowerCase() !== user?.email?.toLowerCase();
    }
  });

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
useEffect(() => {
  if (allColumns.length > 0) {
    setAvailableColumns(allColumns);
  }
}, [allColumns]);

const columnsToRender =
  selectedColumns.length > 0 ? selectedColumns : allColumns;
  const filteredSegments = filteredByTab.filter((row) => {
  return (
    (filters.state.length === 0 || filters.state.includes(row.state)) &&
    (filters.cycle.length === 0 || filters.cycle.includes(row.cycle)) &&
    (filters.recurrence.length === 0 || filters.recurrence.includes(row.recurrence)) &&
    (filters.createdBy.length === 0 || filters.createdBy.includes(row.createdBy))
  );
});

  const sortedSegments = [...filteredSegments].sort((a, b) => {
  
  const aValue = (a as any)[sortField];
  const bValue = (b as any)[sortField];

  if (aValue == null || bValue == null) return 0;

  if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
  if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;

  return 0;
});


  // Calculate pagination based on filtered data
  const filteredCount = filteredSegments.length;
  const totalPages = Math.ceil(filteredCount / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedSegments = sortedSegments.slice(startIndex, startIndex + pageSize);

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

      {/* Tab Navigation */}
      <div className="segments-tabs">
        <TabList
          selectedValue={activeTab}
          onTabSelect={(_, data) => {
            setActiveTab(data.value as SegmentTab);
            setCurrentPage(1); // Reset to first page when switching tabs
          }}
        >
          <Tab value="my">My Segments</Tab>
          <Tab value="all">All Segments</Tab>
        </TabList>
      </div>

<div className="segments-filters">
  


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

    <Tooltip content="Edit Columns" relationship="label">
 <Button
  appearance="subtle"
  icon={< Add24Regular />}
  onClick={() => {
    
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
  icon={<FilterRegular />}
  onClick={() => {

    setIsFilterPanelOpen(true);
  }}
/>  
</Tooltip>
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
        ) : paginatedSegments.length > 0 ? (
          <>
            <Table className="segments-table" aria-label="Segments list" style={{
      tableLayout: "auto"
}}>
           
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
  {paginatedSegments.map((segment) => (
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
                Showing {filteredCount > 0 ? startIndex + 1 : 0}-{Math.min(startIndex + pageSize, filteredCount)} of{' '}
                {filteredCount}
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
              {(searchQuery || false)
                ? 'No segments match your filters.'
                : activeTab === 'my'
                  ? 'You haven\'t created any segments yet.'
                  : 'No other segments available.'}
            </Text>
            {!searchQuery  && activeTab === 'my' && (
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
      <FilterRegular />
      <Text weight="semibold">Filters</Text>
    </div>

    {/* Right side: Close button */}
    <Button
      appearance="subtle"
      icon={<Dismiss24Regular />}
      onClick={() => setIsFilterPanelOpen(false)}
    />
  </div>

  {/* Subtitle */}
  {/* <Text size={300} style={{ marginTop: "6px", color: "#666" }}>
    Select which filters to display in your table.
  </Text> */}
</DrawerHeader>
 <DrawerBody style={{ overflowY: "auto" }}>

  {filterKeys.map((key) => (
    <div key={key} style={{ marginBottom: "16px" }}>
      
      <Text weight="semibold" style={{ marginBottom: "6px", display: "block" }}>
        {key.charAt(0).toUpperCase() + key.slice(1)}
      </Text>

      <Dropdown
        placeholder="Select an option"
        selectedOptions={filters[key]}
        multiselect
        onOptionSelect={(_, data) => {
          setFilters((prev) => ({
            ...prev,
            [key]: data.selectedOptions as string[],
          }));
          setCurrentPage(1);
        }}
        style={{ width: "100%" }}
      >
        {filterOptions[key].map((val) => (
          <Option key={val} value={val}>
            {val}
          </Option>
        ))}
      </Dropdown>

    </div>
  ))}
<div
  style={{
    marginTop: "24px",
    display: "flex",
    justifyContent: "flex-start",
    gap: "10px"
  }}
>
  <Button
    appearance="secondary"
    onClick={() => setIsFilterPanelOpen(false)}
  >
    Close
  </Button>

  <Button
    appearance="primary"
    onClick={() => {
      setFilters({
        state: [],
        cycle: [],
        recurrence: [],
        createdBy: [],
      });
    }}
  >
    Reset
  </Button>
</div>
</DrawerBody>
{/* <DrawerFooter
  style={{
    display: "flex",
    justifyContent: "flex-end",
    gap: "10px",
    borderTop: "1px solid #eee",
    padding: "16px",   // 👈 THIS FIXES POSITION (important)
  }}
>
  <Button
    appearance="primary"
    onClick={() => {
      setFilters({
        state: [],
        cycle: [],
        recurrence: [],
        createdBy: [],
      });
    }}
  >
    Reset
  </Button>

  <Button
    appearance="secondary"
    onClick={() => setIsFilterPanelOpen(false)}
  >
    Close
  </Button>
</DrawerFooter> */}
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
        <Add24Regular />
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
