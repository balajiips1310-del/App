import React, { useState, useRef, useEffect } from 'react';
import {
  Button,
  Spinner,
  Tooltip,
  MessageBar,
  MessageBarBody,
} from '@fluentui/react-components';
import {
  Dismiss24Regular,
  Send24Regular,
  Sparkle24Regular,
  Checkmark20Regular,
  ArrowMaximize24Regular,
  ArrowMinimize24Regular,
  Eye24Regular,
  ArrowSync24Regular,
} from '@fluentui/react-icons';
import ReactMarkdown from 'react-markdown';
import { MessageContent } from '@/components/chat/MessageContent';
import { useChat } from '@/contexts/ChatContext';
import { ChatMessage as ChatMessageType } from '@/types';
import '@/styles/SidecarChat.css';

// Clean up escaped characters and HTML tags from AI response
const cleanupSqlQuery = (text: string): string => {
  return text
    .replace(/<esc>'<\/esc>/gi, "'")
    .replace(/<esc>"<\/esc>/gi, '"')
    .replace(/<esc>/gi, '')
    .replace(/<\/esc>/gi, '')
    // Remove any remaining HTML tags (e.g., <code>, <pre>, <span>, etc.)
    .replace(/<[^>]*>/g, '')
    // Decode HTML entities
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
};

// Extract SQL query from AI response content
const extractSqlFromContent = (content: string): string | null => {
  const cleaned = cleanupSqlQuery(content);
  
  // Try HTML code blocks first: <code>...</code>
  const htmlMatch = cleaned.match(/<code[^>]*>([\s\S]*?)<\/code>/i);
  if (htmlMatch && htmlMatch[1]?.trim() && /SELECT/i.test(htmlMatch[1])) {
    return htmlMatch[1].trim();
  }
  
  // Markdown: ```sql...``` or ```...```
  const mdMatch = cleaned.match(/```(?:sql)?\s*([\s\S]*?)```/i);
  if (mdMatch && mdMatch[1]?.trim() && /SELECT/i.test(mdMatch[1])) {
    return mdMatch[1].trim();
  }
  
  // Fallback: find SELECT...FROM statement directly in text
  const selectMatch = cleaned.match(/(SELECT\s+[\s\S]*?FROM\s+[\s\S]*?)(?=\n\n|Would you|$)/i);
  if (selectMatch && selectMatch[1]?.trim()) {
    return selectMatch[1].trim();
  }
  
  return null;
};

// Normalize query for comparison
const normalizeQuery = (q: string) => q.replace(/\s+/g, ' ').trim().toLowerCase();

// Format SQL query with line breaks for readability
const formatSqlForDisplay = (sql: string): string => {
  if (!sql) return '';
  
  // First strip any HTML tags that may have been added by backend formatting
  let cleaned = sql
    .replace(/<[^>]*>/g, '')  // Remove all HTML tags
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  
  // Keywords that should start a new line
  return cleaned
    .replace(/\s+/g, ' ')  // Normalize whitespace first
    .replace(/\b(SELECT|FROM|WHERE|JOIN|LEFT JOIN|RIGHT JOIN|INNER JOIN|OUTER JOIN|AND|OR|ORDER BY|GROUP BY|HAVING|LIMIT|OFFSET|UNION)\b/gi, '\n$1')
    .replace(/,\s*/g, ',\n    ')  // Add newline + indent after commas
    .replace(/^\n/, '')  // Remove leading newline
    .trim();
};

interface GeneratedSegment {
  name: string;
  description: string;
  query: string;
  previewData: Array<Record<string, string>>;
  previewCount: number;
}

interface SidecarChatProps {
  isOpen: boolean;
  onClose: () => void;
  onApplySegment: (segment: GeneratedSegment) => void;
  /** If true, preserve existing chat history (e.g., when coming from Agent page). If false, clear chat on open. */
  preserveHistory?: boolean;
  /** Current query from the segment form - used for Preview Query Data suggestion */
  currentQuery?: string;
  /** Callback to apply only the query (for refined queries) */
  onApplyQuery?: (query: string) => void;
  onSegmentCreated?: (segment: { query: string; description: string; name?: string }) => void;//changes
}

const SidecarChat: React.FC<SidecarChatProps> = ({ isOpen, onClose, onApplySegment, preserveHistory = false, currentQuery = '', onApplyQuery, onSegmentCreated }) => {
  const { 
    messages, 
    isLoading, 
    isInitializing, 
    error, 
    welcomeMessage, 
    sendMessage,
    initializeChat,
    clearChat,
  } = useChat();
  
  // Track if we've initialized for this component mount
  const hasInitialized = useRef(false);
  
  const [inputValue, setInputValue] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Track which messages have been processed for auto-populate to prevent re-triggering
  const processedMessagesRef = useRef<Set<string>>(new Set());
  
  // Track the latest AI-generated query from messages
  const [latestAiQuery, setLatestAiQuery] = useState<string>('');
  
  // Track which message index was last used for Apply Refined Query
  const lastAppliedMessageIndexRef = useRef<number>(-1);

  // Initialize chat when sidecar opens
  // Only clear chat on first mount if not preserving history AND there are no messages yet
  useEffect(() => {
    if (isOpen && !hasInitialized.current) {
      hasInitialized.current = true;
      if (!preserveHistory && messages.length === 0) {
        // Fresh session with no history - clear any stale backend state and initialize
        clearChat().then(() => {
          initializeChat();
        });
      } else {
        // Either preserving history or already have messages - just initialize
        initializeChat();
      }
    }
  }, [isOpen]); // Only depend on isOpen to avoid re-running on other changes

  // Auto-scroll to bottom
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  // Focus textarea when opened
  useEffect(() => {
    if (isOpen && textareaRef.current && !isInitializing) {
      textareaRef.current.focus();
    }
  }, [isOpen, isInitializing]);

  // Handle create_segment action from backend - auto-populate form in sidecar
  // Only trigger when sidecar is open to prevent Agent page messages from affecting the form
  // Only auto-apply for INITIAL segment creation (when form has no query yet)
  // For refinements, user should use "Apply Refined Query" button
  useEffect(() => {
    if (!isOpen) return; // Only process when sidecar is open
    
    const lastMessage = messages[messages.length - 1];
    if (
      lastMessage?.role === 'assistant' && 
      lastMessage.action?.type === 'create_segment' && 
      lastMessage.action.data &&
      lastMessage.id &&
      !processedMessagesRef.current.has(lastMessage.id)
    ) {
      // Mark this message as processed
      processedMessagesRef.current.add(lastMessage.id);
      
      const { suggestedName, description, query } = lastMessage.action.data;

    
      // Only auto-apply if the form doesn't have a query yet (initial creation)
      // For refinements, user should manually click "Apply Refined Query"
      if (!currentQuery.trim()) {
        onApplySegment({
          name: suggestedName || 'AI Generated Segment',
          description: description || 'Segment created from AI conversation',
          query: query || '',
          previewData: [],
          previewCount: 0,
        });
      }
  // Notify Create Segment page
     if (onSegmentCreated && query) {
         onSegmentCreated({
         query: query,
         description: description || 'Segment created from AI',
         name: suggestedName || 'AI Generated Segment'
      });
    }
      

    }
  }, [isOpen, messages, onApplySegment, currentQuery]);

  // Extract latest SQL query from AI messages (from action data or code blocks)
  // Only looks at messages AFTER the last applied message index
  useEffect(() => {
    if (!isOpen || messages.length === 0) return;
    
    const startIndex = messages.length - 1;
    const stopIndex = lastAppliedMessageIndexRef.current;
    
    // Look for the most recent query in messages (reverse order), but stop at last applied
    for (let i = startIndex; i > stopIndex; i--) {
      const msg = messages[i];
      if (msg.role === 'assistant') {
        // First check action data (any action type that has a query)
        if (msg.action?.data?.query) {
          const query = cleanupSqlQuery(msg.action.data.query);
          if (/SELECT/i.test(query)) {
            setLatestAiQuery(query);
            return;
          }
        }
        
        // Then check for SQL in content (HTML/markdown code blocks)
        if (msg.content) {
          const extractedQuery = extractSqlFromContent(msg.content);
          if (extractedQuery) {
            setLatestAiQuery(extractedQuery);
            return;
          }
        }
      }
    }
  }, [isOpen, messages]);

  const handleSend = async (messageText?: string) => {
    const text = messageText || inputValue.trim();
    if (!text || isLoading) return;

    setInputValue('');
    
    // Send message to backend - agent drives the conversation
    // Backend returns action data (create_segment) when user requests segment creation
    await sendMessage(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  const panelClass = `sidecar-panel ${isOpen ? 'open' : ''} ${isExpanded ? 'expanded' : ''}`;

  return (
    <>
      <div className={`sidecar-overlay ${isOpen ? 'open' : ''}`} onClick={onClose} />
      <div className={panelClass}>
        <div className="sidecar-header">
          <h3>
            <Sparkle24Regular />
            Segmentation Agent
          </h3>
          <div className="sidecar-header-actions">
            <Tooltip content={isExpanded ? 'Collapse panel' : 'Expand panel'} relationship="label">
              <Button
                appearance="subtle"
                icon={isExpanded ? <ArrowMinimize24Regular /> : <ArrowMaximize24Regular />}
                onClick={toggleExpand}
                aria-label={isExpanded ? 'Collapse' : 'Expand'}
              />
            </Tooltip>
            <Button
              appearance="subtle"
              icon={<Dismiss24Regular />}
              onClick={onClose}
              aria-label="Close"
            />
          </div>
        </div>

        {error && (
          <MessageBar intent="error" className="sidecar-error">
            <MessageBarBody>{error}</MessageBarBody>
          </MessageBar>
        )}

        <div className="sidecar-content">
          {isInitializing ? (
            <div className="sidecar-loading">
              <Spinner size="medium" />
              <span>Connecting to the agent...</span>
            </div>
          ) : messages.length === 0 ? (
            <div className="sidecar-welcome">
              <div className="sidecar-welcome-icon">
                <Sparkle24Regular />
              </div>
              <h4>Generate Segment with AI</h4>
              {welcomeMessage ? (
                <div className="sidecar-welcome-message">
                  <ReactMarkdown>{welcomeMessage}</ReactMarkdown>
                </div>
              ) : (
                <>
                  <p>
                    Describe your target audience or segment criteria in natural language, 
                    and I'll generate the appropriate query for you.
                  </p>
                  <p className="sidecar-tip">
                    <strong>💡 Tip:</strong> After I generate a query, say <em>"Use this"</em> or <em>"Apply this"</em> to populate the form.
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="sidecar-messages">
              {messages
                .filter((message: ChatMessageType) => 
                  // Filter out empty assistant messages
                  message.role === 'user' || (message.content && message.content.trim())
                )
                .map((message: ChatMessageType) => (
                <div key={message.id} className={`sidecar-message ${message.role}`}>
                  <div className="sidecar-message-avatar">
                    <Sparkle24Regular />
                  </div>
                  <div className="sidecar-message-content">
                    <div className="sidecar-message-bubble">
                      {message.role === 'user' ? (
                        <ReactMarkdown>{message.content}</ReactMarkdown>
                      ) : (
                        <MessageContent content={message.content} />
                      )}
                    </div>
                    
                    {/* Show confirmation when form was populated from create_segment action */}
                    {message.action?.type === 'create_segment' && (
                      <div className="sidecar-action-applied">
                        <Checkmark20Regular />
                        <span>Form populated with segment details</span>
                      </div>
                    )}
                    
                    <div className="sidecar-message-time">
                      {new Date(message.timestamp).toLocaleTimeString([], { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </div>
                  </div>
                </div>
              ))}
              
              {isLoading && (
                <div className="sidecar-typing">
                  <Spinner size="tiny" />
                  <span>Processing...</span>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
          )}


        </div>

        <div className="sidecar-input-area">
          {/* Suggestion buttons */}
          <div className="sidecar-suggestion-buttons">
            {/* Preview Query Data - show when there's a valid query in the form */}
            {currentQuery.trim() && (
              <Button
                appearance="subtle"
                icon={<Eye24Regular />}
                size="small"
                onClick={() => handleSend(`Preview this query data:\n\`\`\`sql\n${formatSqlForDisplay(currentQuery)}\n\`\`\``)}
                disabled={isLoading || isInitializing}
                className="sidecar-suggestion-button"
              >
                Preview Query Data
              </Button>
            )}
            {/* Apply Refined Query - only show after form has been populated via create_segment action */}
            {onApplyQuery && messages.some(m => m.action?.type === 'create_segment') && (
              <Tooltip 
                content={
                  latestAiQuery && normalizeQuery(latestAiQuery) === normalizeQuery(currentQuery)
                    ? "Query is already applied"
                    : "Apply the latest query from AI conversation"
                } 
                relationship="label"
              >
                <Button
                  appearance="subtle"
                  icon={<ArrowSync24Regular />}
                  size="small"
                  onClick={() => {
                    // Find the most recent query from any assistant message
                    let queryToApply = latestAiQuery;
                    if (!queryToApply) {
                      // Search all assistant messages for a query (most recent first)
                      for (let i = messages.length - 1; i >= 0; i--) {
                        const msg = messages[i];
                        if (msg.role === 'assistant') {
                          // Check action data first
                          if (msg.action?.data?.query) {
                            const q = cleanupSqlQuery(msg.action.data.query);
                            if (/SELECT/i.test(q)) {
                              queryToApply = q;
                              break;
                            }
                          }
                          // Then check content
                          if (msg.content) {
                            const extracted = extractSqlFromContent(msg.content);
                            if (extracted) {
                              queryToApply = extracted;
                              break;
                            }
                          }
                        }
                      }
                    }
                    if (queryToApply) {
                      onApplyQuery(queryToApply);
                      lastAppliedMessageIndexRef.current = messages.length - 1;
                      setLatestAiQuery('');
                    }
                  }}
                  disabled={isLoading || isInitializing || (!!latestAiQuery && normalizeQuery(latestAiQuery) === normalizeQuery(currentQuery))}
                  className={`sidecar-suggestion-button ${latestAiQuery && normalizeQuery(latestAiQuery) !== normalizeQuery(currentQuery) ? 'sidecar-apply-query-button' : ''}`}
                >
                  Apply Refined Query
                </Button>
              </Tooltip>
            )}
          </div>
          <div className="sidecar-input-container">
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe your segment requirements... (Enter to send)"
              rows={2}
              disabled={isLoading || isInitializing}
            />
            <Button
              appearance="primary"
              icon={<Send24Regular />}
              onClick={() => handleSend()}
              disabled={!inputValue.trim() || isLoading || isInitializing}
              className="sidecar-send-button"
            />
          </div>
        </div>
      </div>
    </>
  );
};

export default SidecarChat;
