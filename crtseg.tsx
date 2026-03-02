import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import {
  Card,
  Text,
  Input,
  Button,
  Radio,
  RadioGroup,
  Dropdown,
  Option,
  MessageBar,
  MessageBarBody,
  Badge,
} from '@fluentui/react-components';
import {
  ArrowLeft24Regular,
  Sparkle24Regular,
  Save24Regular,
  TableSettings24Regular,
} from '@fluentui/react-icons';
import SidecarChat from '@/components/common/SidecarChat';
import SelectColumnsPanel from '@/components/common/SelectColumnsPanel';
import { Segment, SegmentCycle, RecurrencePattern } from '@/types/segment';
import { segmentService } from '@/services/segmentService';
import '@/styles/CreateSegmentPage.css';

// Clean SQL query by removing HTML tags and decoding entities
const cleanSqlQuery = (sql: string): string => {
  if (!sql) return '';
  return sql
    .replace(/<[^>]*>/g, '')  // Remove all HTML tags
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
};

// Format SQL query with line breaks for readability
const formatSqlQuery = (sql: string): string => {
  if (!sql) return '';
  
  // First clean the query
  let cleaned = cleanSqlQuery(sql);
  
  // Keywords that should start a new line
  const newLineKeywords = /\b(SELECT|FROM|WHERE|JOIN|LEFT JOIN|RIGHT JOIN|INNER JOIN|OUTER JOIN|AND|OR|ORDER BY|GROUP BY|HAVING|LIMIT|OFFSET|UNION|EXCEPT|INTERSECT)\b/gi;
  
  return cleaned
    .replace(/\s+/g, ' ')  // Normalize whitespace
    .replace(newLineKeywords, '\n$1')  // Add newline before keywords
    .replace(/,\s*/g, ',\n    ')  // Add newline after commas (for column lists)
    .replace(/^\n/, '')  // Remove leading newline
    .trim();
};

interface PrefillData {
  name?: string;
  description?: string;
  query?: string;
}

interface LocationState {
  cloneFrom?: Segment;
  prefill?: PrefillData;
}

interface GeneratedSegment {
  name: string;
  description: string;
  query: string;
  previewData: Array<Record<string, string>>;
  previewCount: number;
}

export const CreateSegmentPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const locationState = location.state as LocationState | undefined;
  const cloneFrom = locationState?.cloneFrom;
  const prefill = locationState?.prefill;

  // Get prefill data from URL params (for Teams bot deep linking) or location state
  const urlPrefill = useMemo((): PrefillData => ({
    name: searchParams.get('name') || undefined,
    description: searchParams.get('description') || undefined,
    query: searchParams.get('query') || undefined,
  }), [searchParams]);

  // Priority: URL params > location state prefill > cloneFrom
  const effectivePrefill = useMemo(() => ({
    name: urlPrefill.name || prefill?.name,
    description: urlPrefill.description || prefill?.description,
    query: urlPrefill.query || prefill?.query,
  }), [urlPrefill, prefill]);

  // Form state - check prefill first, then cloneFrom
  const [name, setName] = useState(effectivePrefill?.name || (cloneFrom ? `${cloneFrom.name} (Copy)` : ''));
  const [description, setDescription] = useState(effectivePrefill?.description || cloneFrom?.description || '');
  const [query, setQuery] = useState(effectivePrefill?.query || cloneFrom?.query || '');
  const [cycle, setCycle] = useState<SegmentCycle>(cloneFrom?.cycle || 'Adhoc');
  const [recurrence, setRecurrence] = useState<RecurrencePattern | null>(cloneFrom?.recurrence || null);
  const [startDate, setStartDate] = useState(cloneFrom?.startDate || '');
  const [startTime, setStartTime] = useState('09:00');
  const [endDate, setEndDate] = useState(cloneFrom?.endDate || '');
  
  const [showSidecar, setShowSidecar] = useState(false);
  const [showSelectColumns, setShowSelectColumns] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  const [validationError, setValidationError] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (cloneFrom?.nextScheduledDateTime) {
      const date = new Date(cloneFrom.nextScheduledDateTime);
      setStartTime(date.toTimeString().slice(0, 5));
    }
  }, [cloneFrom]);

  // Clear recurrence when Adhoc is selected (schedule fields optional for Adhoc)
  useEffect(() => {
    if (cycle === 'Adhoc') {
      setRecurrence(null);
    }
  }, [cycle]);

  // Check if all required fields are filled for Publish button
  const isPublishEnabled = useMemo(() => {
    const hasBasicInfo = name.trim() !== '' && query.trim() !== '';
    
    // Adhoc has optional schedule fields
    if (cycle === 'Adhoc') {
      return hasBasicInfo;
    }
    
    // Recurring requires time and start date
    return hasBasicInfo && startTime.trim() !== '' && startDate.trim() !== '';
  }, [name, query, cycle, startTime, startDate]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!query.trim()) {
      newErrors.query = 'Query is required. Use "Generate with AI" to create a query.';
    }

    // Adhoc has optional schedule fields, Recurring requires them
    if (cycle === 'Recurring') {
      if (!startDate) {
        newErrors.startDate = 'Start date is required';
      }

      if (!startTime) {
        newErrors.startTime = 'Start time is required';
      }
    }

    setErrors(newErrors);
    const hasErrors = Object.keys(newErrors).length > 0;
    setValidationError(hasErrors);
    return !hasErrors;
  };

  const handleSubmit = async (asDraft: boolean = false) => {
    if (!validateForm() && !asDraft) return;

    // Clear validation error when submitting
    setValidationError(false);
    setSubmitting(true);
    setSubmitError(null);
    setDraftSaved(false);

    try {
      await segmentService.create({
        name,
        description: description || undefined,
        query,
        cycle,
        recurrence: recurrence || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        scheduledTime: startTime || undefined,
        saveAsDraft: asDraft,
      });

      if (asDraft) {
        // Show draft saved message and stay on page
        setDraftSaved(true);
        // Auto-hide the message after 5 seconds
        setTimeout(() => setDraftSaved(false), 5000);
      } else {
        // Navigate to segments list after publishing
        setShowSuccess(true);
        setTimeout(() => {
          navigate('/segments');
        }, 1500);
      }
    } catch (err: any) {
      // Parse error message from various response formats
      let errorMessage = 'Failed to create segment';
      
      if (err.response?.data) {
        const data = err.response.data;
        // Handle different error response formats
        if (typeof data === 'string') {
          errorMessage = data;
        } else if (data.error) {
          errorMessage = data.error;
        } else if (data.message) {
          errorMessage = data.message;
        } else if (data.title) {
          // ASP.NET validation error format
          errorMessage = data.title;
          if (data.errors) {
            const fieldErrors = Object.entries(data.errors)
              .map(([field, msgs]) => `${field}: ${(msgs as string[]).join(', ')}`)
              .join('; ');
            if (fieldErrors) {
              errorMessage += ` - ${fieldErrors}`;
            }
          }
        }
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setSubmitError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const handleApplySegment = (segment: GeneratedSegment) => {
    setName(segment.name);
    setDescription(segment.description);
    setQuery(segment.query);

    // Clear errors
    setErrors({});
    setValidationError(false);
  };

  return (
    <div className="create-segment-manual-page">
      {/* Page Header */}
      <div className="create-segment-page-header">
        {/* Title row */}
        <div className="create-segment-title-row">
          <Text as="h1" size={700} weight="semibold" className="create-segment-title">
            {cloneFrom ? 'Clone Segment' : 'Create New Segment'}
          </Text>
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

          <span className="toolbar-divider" />

          <Button appearance="subtle" icon={<Save24Regular />} onClick={() => handleSubmit(true)} disabled={submitting}>
            {submitting ? 'Saving...' : 'Save as Draft'}
          </Button>

          <Button 
            appearance="subtle" 
            icon={<Save24Regular />} 
            onClick={() => handleSubmit(false)}
            disabled={!isPublishEnabled || submitting}
          >
            {submitting ? 'Publishing...' : 'Publish'}
          </Button>

          <span className="toolbar-divider" />

          <Button
            appearance="subtle"
            icon={<TableSettings24Regular />}
            onClick={() => {
              setShowSidecar(false); // Close AI sidecar first
              setShowSelectColumns(true);
            }}
            disabled={!query.trim()}
          >
            Select Projections
          </Button>

          <Button
            appearance="subtle"
            icon={<Sparkle24Regular />}
            onClick={() => {
              setShowSelectColumns(false); // Close Select Columns first
              setShowSidecar(!showSidecar);
            }}
          >
            Generate with AI
          </Button>
        </div>
      </div>

      {/* Page Content */}
      <div className="create-segment-content">
        {showSuccess && (
          <MessageBar intent="success">
            <MessageBarBody>
              Segment created successfully! Redirecting...
            </MessageBarBody>
          </MessageBar>
        )}

        {draftSaved && (
          <MessageBar intent="success">
            <MessageBarBody>
              Draft saved successfully! You can continue editing or use the Back button to navigate away.
            </MessageBarBody>
          </MessageBar>
        )}

        {validationError && (
          <MessageBar intent="warning">
            <MessageBarBody>
              Please fill in all required fields before publishing. Check the highlighted fields below.
            </MessageBarBody>
          </MessageBar>
        )}

        {submitError && (
          <MessageBar intent="error">
            <MessageBarBody>{submitError}</MessageBarBody>
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
              <label className="form-field-label required">Name</label>
              <Input
                value={name}
                onChange={(_, data) => {
                  setName(data.value);
                  if (errors.name) setErrors(prev => ({ ...prev, name: '' }));
                  if (validationError) setValidationError(false);
                }}
                placeholder="Enter segment name"
                aria-invalid={!!errors.name}
              />
              {errors.name && (
                <span className="form-field-hint error-hint">
                  {errors.name}
                </span>
              )}
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
              <label className="form-field-label required">Cycle</label>
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
                  onChange={(_, data) => {
                    setStartTime(data.value);
                    if (errors.startTime) setErrors(prev => ({ ...prev, startTime: '' }));
                    if (validationError) setValidationError(false);
                  }}
                  aria-invalid={!!errors.startTime}
                />
              </div>
            </div>

            <div className="schedule-fields-row">
              <div className="form-field">
                <label className={`form-field-label ${cycle === 'Recurring' ? 'required' : ''}`}>Start Date</label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(_, data) => {
                    setStartDate(data.value);
                    if (errors.startDate) setErrors(prev => ({ ...prev, startDate: '' }));
                    if (validationError) setValidationError(false);
                  }}
                  aria-invalid={!!errors.startDate}
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

          <pre className="segment-query-code">{query ? formatSqlQuery(query) : 'Use "Generate with AI" to describe your segment criteria and auto-populate the form...'}</pre>
        </Card>
        </div>
      </div>

      {/* AI Sidecar Chat - only render when user explicitly opens it */}
      {/* preserveHistory=true when coming from Agent page (prefill exists), false for direct navigation */}
      {showSidecar && (
        <SidecarChat
          isOpen={showSidecar}
          onClose={() => setShowSidecar(false)}
          onApplySegment={handleApplySegment}
          onApplyQuery={(refinedQuery) => {
            // Clean HTML tags from the query before applying
            setQuery(cleanSqlQuery(refinedQuery));
      

            // Clear any query-related errors
            if (errors.query) {
              setErrors(prev => ({ ...prev, query: '' }));
            }
          }}
               
            onSegmentCreated={(segment) => {
                setQuery(cleanSqlQuery(segment.query));
                setDescription(segment.description || '');
               setName(segment.name || 'AI Generated Segment');
               setErrors({});
               setValidationError(false);
                }}
          preserveHistory={!!prefill}
          currentQuery={query}
        />
      )}

      {/* Select Columns Panel */}
      <SelectColumnsPanel
        isOpen={showSelectColumns}
        onClose={() => setShowSelectColumns(false)}
        query={query}
        onApply={(updatedQuery) => {
          setQuery(updatedQuery);
          // Clear query error if it was set
          if (errors.query) setErrors(prev => ({ ...prev, query: '' }));
          if (validationError) setValidationError(false);
        }}
      />
    </div>
  );
};
