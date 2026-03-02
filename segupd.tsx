import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Text,
  Button,
  Input,
  Dropdown,
  Option,
  Radio,
  RadioGroup,
  Tooltip,
  MessageBar,
  MessageBarBody,
  Badge,
  Spinner,
} from '@fluentui/react-components';
import {
  ArrowLeft24Regular,
  Play24Regular,
  Delete24Regular,
  Warning48Regular,
  Eye24Regular,
  Table24Regular,
  TableSettings24Regular,
  Lightbulb24Regular,
  Pause24Regular,
} from '@fluentui/react-icons';
import { SegmentCycle, RecurrencePattern, SegmentDetail } from '@/types/segment';
import { segmentService } from '@/services/segmentService';
import { InsightsSidecar } from '@/components/common/InsightsSidecar';
import SelectColumnsPanel from '@/components/common/SelectColumnsPanel';
import '@/styles/CreateSegmentPage.css';

export const SegmentDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // API state
  const [segment, setSegment] = useState<SegmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state for editing
  const [description, setDescription] = useState('');

  // Select Projection Query
  // Projection editing
  const [query, setQuery] = useState('');
  const [showSelectColumns, setShowSelectColumns] = useState(false);
    
  // Schedule form state
  const [cycle, setCycle] = useState<SegmentCycle>('Adhoc');
  const [recurrence, setRecurrence] = useState<RecurrencePattern | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  
  // Insights sidecar state
  const [showInsightsSidecar, setShowInsightsSidecar] = useState(false);
  
  // Preview data state
  const [showPreview, setShowPreview] = useState(false);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewData, setPreviewData] = useState<Array<Record<string, string>>>([]);
  
  // Track if there are unsaved changes
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch segment from API
  const fetchSegment = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await segmentService.getById(id);
      if (data) {
        setSegment(data);
        setQuery(data.query);
        setDescription(data.description || '');
        setCycle(data.cycle);
        setRecurrence(data.recurrence);
        setStartDate(data.startDate || '');
        setEndDate(data.endDate || '');
        if (data.scheduledTime) {
          setStartTime(data.scheduledTime);
        } else if (data.nextScheduledDateTime) {
          setStartTime(new Date(data.nextScheduledDateTime).toTimeString().slice(0, 5));
        }
        setHasChanges(false); // Reset changes flag when segment is loaded
      } else {
        setError('Segment not found');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load segment');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchSegment();
  }, [fetchSegment]);

  // Track changes to form fields
  useEffect(() => {
    if (!segment) return;
    const changed = 
      description !== (segment.description || '') ||
      cycle !== segment.cycle ||
      recurrence !== segment.recurrence ||
      startDate !== (segment.startDate || '') ||
      endDate !== (segment.endDate || '') ||
      startTime !== (segment.scheduledTime || '09:00') ||
      query !== segment.query;
    setHasChanges(changed);
  }, [segment, description, cycle, recurrence, startDate, endDate, startTime, query]);

  if (loading) {
    return (
      <div className="segment-detail-page">
        <div className="loading-state">
          <Spinner size="large" label="Loading segment..." />
        </div>
      </div>
    );
  }

  if (error || !segment) {
    return (
      <div className="segment-detail-page">
        <span
          className="segment-detail-back"
          onClick={() => navigate('/segments')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') navigate('/segments');
          }}
        >
          <ArrowLeft24Regular />
          Back to Segments
        </span>

        <div className="segment-not-found">
          <Warning48Regular className="segment-not-found-icon" />
          <Text size={500} weight="semibold">
            Segment Not Found
          </Text>
          <Text>The segment you're looking for doesn't exist or has been deleted.</Text>
          <Button appearance="primary" onClick={() => navigate('/segments')}>
            View All Segments
          </Button>
        </div>
      </div>
    );
  }

  // Note: Save schedule functionality is handled via handlePublish
  // const handleSaveSchedule = async () => {
  //   if (!segment) return;
  //   setSaving(true);
  //   setSaveError(null);
  //   try {
  //     const updated = await segmentService.update(segment.id, {
  //       description,
  //       cycle,
  //       recurrence: recurrence || undefined,
  //       startDate: startDate || undefined,
  //       endDate: endDate || undefined,
  //       scheduledTime: startTime || undefined,
  //       rowVersion: segment.rowVersion,
  //     });
  //     setSegment(updated);
  //     setShowSaveSuccess(true);
  //     setTimeout(() => setShowSaveSuccess(false), 3000);
  //   } catch (err: any) {
  //     setSaveError(err.response?.data?.message || err.message || 'Failed to save changes');
  //   } finally {
  //     setSaving(false);
  //   }
  // };

  const handleRunNow = async () => {
    if (!segment) return;
    try {
      await segmentService.run(segment.id);
      alert('Segment execution triggered!');
      fetchSegment(); // Refresh to get updated state
    } catch (err: any) {
      alert('Failed to run segment: ' + (err.message || 'Unknown error'));
    }
  };

  const handlePublish = async () => {
    if (!segment) return;
    setSaving(true);
    try {
      // If there are changes, save them first
      if (hasChanges) {
        await segmentService.update(segment.id, {
          description,
          cycle,
          recurrence: recurrence || undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          scheduledTime: startTime || undefined,
          query: query,           
          rowVersion: segment.rowVersion,
        });
      }
      // Then update state to Active (if not already)
      if (segment.state !== 'Active') {
        await segmentService.updateState(segment.id, 'Active');
      }
      await fetchSegment();
      setShowSaveSuccess(true);
      setTimeout(() => setShowSaveSuccess(false), 3000);
    } catch (err: any) {
      setSaveError(err.response?.data?.message || err.message || 'Failed to publish segment');
    } finally {
      setSaving(false);
    }
  };

  const handlePause = async () => {
    if (!segment) return;
    setSaving(true);
    try {
      await segmentService.updateState(segment.id, 'Paused');
      await fetchSegment();
      setShowSaveSuccess(true);
      setTimeout(() => setShowSaveSuccess(false), 3000);
    } catch (err: any) {
      setSaveError(err.response?.data?.message || err.message || 'Failed to pause segment');
    } finally {
      setSaving(false);
    }
  };

  const handleResume = async () => {
    if (!segment) return;
    setSaving(true);
    try {
      await segmentService.resume(segment.id);
      await fetchSegment();
      setShowSaveSuccess(true);
      setTimeout(() => setShowSaveSuccess(false), 3000);
    } catch (err: any) {
      setSaveError(err.response?.data?.message || err.message || 'Failed to resume segment');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!segment) return;
    if (!confirm(`Are you sure you want to delete "${segment.name}"?`)) return;
    try {
      await segmentService.delete(segment.id);
      navigate('/segments');
    } catch (err: any) {
      alert('Failed to delete segment: ' + (err.message || 'Unknown error'));
    }
  };

  const handlePreviewQuery = async () => {
    setIsLoadingPreview(true);
    
    // Simulate API call to preview query results
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Mock preview data
    setPreviewData([
      { CustomerId: 'C001', Name: 'Contoso Ltd', Email: 'admin@contoso.com', Revenue: '$2.5M' },
      { CustomerId: 'C002', Name: 'Fabrikam Inc', Email: 'contact@fabrikam.com', Revenue: '$1.8M' },
      { CustomerId: 'C003', Name: 'Adventure Works', Email: 'info@adventure.com', Revenue: '$1.2M' },
      { CustomerId: 'C004', Name: 'Northwind Traders', Email: 'sales@northwind.com', Revenue: '$1.1M' },
      { CustomerId: 'C005', Name: 'Tailspin Toys', Email: 'hello@tailspin.com', Revenue: '$950K' },
    ]);
    setShowPreview(true);
    setIsLoadingPreview(false);
  };

  return (
    <>
    <div className="create-segment-manual-page">
      {/* Page Header */}
      <div className="create-segment-page-header">
        {/* Title row with status badges */}
        <div className="create-segment-title-row">
          <Text as="h1" size={700} weight="semibold" className="create-segment-title">
            Edit Segment
          </Text>
          <div className="segment-detail-status-badges">
            <Badge appearance="outline" color={segment.state === 'Active' ? 'success' : segment.state === 'Paused' ? 'warning' : 'informative'}>
              {segment.state}
            </Badge>
            <Badge appearance="outline" color="informative">
              {segment.cycle}
            </Badge>
          </div>
        </div>

        {/* Action toolbar */}
        <div className="create-segment-toolbar">
          <span
            className="create-segment-back"
            onClick={() => navigate('/segments')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') navigate('/segments');
            }}
          >
            <ArrowLeft24Regular />
            Back
          </span>

          <Button
            appearance="subtle"
            icon={<TableSettings24Regular />}
            onClick={() => {
              setShowInsightsSidecar(false); // Close AI sidecar first
              setShowSelectColumns(true);
            }}
            disabled={!query.trim()}
          >
            Select Projections
          </Button>

          <span className="toolbar-divider" />

          <Tooltip content={segment.state === 'Active' && !hasChanges ? "No changes to publish" : "Publish segment to make it active"} relationship="label">
            <Button 
              appearance="subtle" 
              icon={<Play24Regular />} 
              onClick={handlePublish} 
              disabled={saving || segment.isRunning || (segment.state === 'Active' && !hasChanges)}
            >
              {saving ? 'Publishing...' : 'Publish'}
            </Button>
          </Tooltip>

          <Tooltip content={segment.cycle === 'Adhoc' ? "Adhoc segments cannot be paused" : segment.state !== 'Active' ? "Only active segments can be paused" : "Pause segment execution"} relationship="label">
            <Button appearance="subtle" icon={<Pause24Regular />} onClick={handlePause} disabled={saving || segment.isRunning || segment.state !== 'Active' || segment.cycle === 'Adhoc'}>
              Pause
            </Button>
          </Tooltip>

          {segment.state === 'Paused' && (
            <Tooltip content="Resume segment execution" relationship="label">
              <Button appearance="subtle" icon={<Play24Regular />} onClick={handleResume} disabled={saving || segment.isRunning}>
                Resume
              </Button>
            </Tooltip>
          )}

          <Tooltip content={segment.state !== 'Active' ? "Only active segments can be run" : "Execute segment immediately"} relationship="label">
            <Button appearance="subtle" icon={<Play24Regular />} onClick={handleRunNow} disabled={segment.isRunning || segment.state !== 'Active'}>
              Run Now
            </Button>
          </Tooltip>

          <Tooltip content="Delete segment permanently" relationship="label">
            <Button appearance="subtle" icon={<Delete24Regular />} onClick={handleDelete} disabled={segment.isRunning}>
              Delete
            </Button>
          </Tooltip>

          <span className="toolbar-divider" />

          <Tooltip content="Get AI-powered insights about this segment" relationship="label">
            <Button
              appearance="subtle"
              icon={<Lightbulb24Regular />}
              onClick={() => setShowInsightsSidecar(!showInsightsSidecar)}
            >
              Generate Insights
            </Button>
          </Tooltip>

          <Tooltip content={segment.state !== 'Active' ? "Only active segments can be previewed" : "Preview query results"} relationship="label">
            <Button
              appearance="subtle"
              icon={<Eye24Regular />}
              onClick={handlePreviewQuery}
              disabled={isLoadingPreview || segment.state !== 'Active'}
            >
              {isLoadingPreview ? 'Loading...' : 'Preview'}
            </Button>
          </Tooltip>
        </div>
      </div>

      {/* Page Content */}
      <div className="create-segment-content">
        {showSaveSuccess && (
          <MessageBar intent="success">
            <MessageBarBody>Changes saved successfully!</MessageBarBody>
          </MessageBar>
        )}

        {saveError && (
          <MessageBar intent="error">
            <MessageBarBody>{saveError}</MessageBarBody>
          </MessageBar>
        )}

        {segment.isRunning && (
          <MessageBar intent="warning">
            <MessageBarBody>This segment is currently running. Editing is disabled until the run completes.</MessageBarBody>
          </MessageBar>
        )}

        <div className="create-segment-form">
          {/* Two-column grid: Basic Info + Schedule */}
          <div className="create-segment-grid">
            {/* Basic Information */}
            <Card className="form-section">
              <Text as="h2" size={500} weight="semibold" className="form-section-title">
                Basic Information
              </Text>

              <div className="form-fields">
                <div className="form-field">
                  <label className="form-field-label">Name</label>
                  <Text className="form-field-readonly">{segment.name}</Text>
                </div>

                <div className="form-field">
                  <label className="form-field-label">Description</label>
                  <textarea
                    className="description-textarea"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Enter a brief description"
                  />
                </div>
              </div>
            </Card>

            {/* Schedule Configuration */}
            <Card className="form-section">
              <Text as="h2" size={500} weight="semibold" className="form-section-title">
                Schedule
              </Text>

              <div className="form-fields">
                <div className="form-field">
                  <label className="form-field-label">Cycle</label>
                  <RadioGroup
                    value={cycle}
                    onChange={(_, data) => {
                      setCycle(data.value as SegmentCycle);
                      if (data.value === 'Recurring') {
                        setRecurrence('Daily');
                      } else {
                        setRecurrence(null);
                      }
                    }}
                    layout="horizontal"
                    className="cycle-radio-group"
                  >
                    <Radio value="Adhoc" label="Adhoc" />
                    <Radio value="Recurring" label="Recurring" />
                  </RadioGroup>
                </div>

                <div className="schedule-fields-row">
                  <div className="form-field">
                    <label className={`form-field-label ${cycle !== 'Recurring' ? 'disabled-label' : ''}`}>Recurrence</label>
                    <Dropdown
                      value={recurrence || ''}
                      onOptionSelect={(_, data) => setRecurrence(data.optionValue as RecurrencePattern)}
                      placeholder="Select recurrence"
                      disabled={cycle !== 'Recurring'}
                    >
                      <Option value="Hourly">Hourly</Option>
                      <Option value="Daily">Daily</Option>
                      <Option value="Weekly">Weekly</Option>
                      <Option value="Monthly">Monthly</Option>
                    </Dropdown>
                  </div>

                  <div className="form-field">
                    <label className={`form-field-label ${cycle === 'Recurring' ? 'required' : ''}`}>Time</label>
                    <Input
                      type="time"
                      value={startTime}
                      onChange={(_, data) => setStartTime(data.value)}
                    />
                  </div>
                </div>

                <div className="schedule-fields-row">
                  <div className="form-field">
                    <label className={`form-field-label ${cycle === 'Recurring' ? 'required' : ''}`}>Start Date</label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(_, data) => setStartDate(data.value)}
                    />
                  </div>

                  <div className="form-field">
                    <label className={`form-field-label ${cycle !== 'Recurring' ? 'disabled-label' : ''}`}>
                      End Date
                    </label>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(_, data) => setEndDate(data.value)}
                      disabled={cycle !== 'Recurring'}
                    />
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Segmentation Query - Full width below (Read-only) */}
          <Card className="form-section segment-query-card">
            <Text as="h2" size={500} weight="semibold" className="form-section-title">
              Segmentation Query
              <Badge appearance="outline" color="informative" style={{ marginLeft: '8px' }}>Read Only</Badge>
            </Text>

            <pre className="segment-query-code">{query}</pre>

            {/* Preview Data Section */}
            {showPreview && previewData.length > 0 && (
              <div className="query-preview-section">
                <div className="preview-header">
                  <h3>
                    <Table24Regular />
                    Preview Data
                  </h3>
                  <span className="preview-count">
                    Showing {previewData.length} of {segment.audiencesCount.toLocaleString()} total records
                  </span>
                </div>
                <div className="preview-table-container">
                  <table className="preview-table">
                    <thead>
                      <tr>
                        {Object.keys(previewData[0]).map(key => (
                          <th key={key}>{key}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.map((row, idx) => (
                        <tr key={idx}>
                          {Object.values(row).map((val, vidx) => (
                            <td key={vidx}>{val}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Insights Sidecar */}
      <InsightsSidecar
        isOpen={showInsightsSidecar}
        onClose={() => setShowInsightsSidecar(false)}
        segment={segment}
      />
    </div>
     <SelectColumnsPanel
      isOpen={showSelectColumns}
      onClose={() => setShowSelectColumns(false)}
      query={query}
      onApply={(updatedQuery) => {
        setQuery(updatedQuery);
      }}
    />
    </>
 
  );
};
