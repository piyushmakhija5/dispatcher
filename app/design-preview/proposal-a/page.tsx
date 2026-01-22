'use client';

import Link from 'next/link';

// Proposal A: Classic Enterprise
// Conservative, minimal color, maximum whitespace
// Thin borders, no shadows, muted semantic colors
// Think: SAP, Oracle-level professional

export default function ProposalA() {
  // Color palette for Proposal A
  const colors = {
    navy: '#1E3A5F',
    navyLight: '#334E68',
    teal: '#0891B2',
    tealMuted: '#94A3B8', // More muted teal
    success: '#059669', // Muted emerald
    warning: '#D97706', // Muted amber
    critical: '#DC2626', // Muted red
    bgPrimary: '#FFFFFF',
    bgSecondary: '#F8FAFC',
    bgTertiary: '#F1F5F9',
    border: '#E2E8F0',
    textPrimary: '#1E293B',
    textSecondary: '#64748B',
    textTertiary: '#94A3B8',
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: colors.bgSecondary,
      fontFamily: 'Inter, system-ui, sans-serif'
    }}>
      {/* Navigation */}
      <div style={{
        backgroundColor: colors.bgPrimary,
        borderBottom: `1px solid ${colors.border}`,
        padding: '12px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <Link href="/design-preview" style={{
          color: colors.tealMuted,
          textDecoration: 'none',
          fontSize: '14px',
          display: 'flex',
          alignItems: 'center',
          gap: '4px'
        }}>
          ← Back to proposals
        </Link>
        <span style={{
          fontSize: '12px',
          color: colors.textTertiary,
          backgroundColor: colors.bgTertiary,
          padding: '4px 12px',
          borderRadius: '4px'
        }}>
          Proposal A: Classic Enterprise
        </span>
      </div>

      {/* Header */}
      <header style={{
        backgroundColor: colors.bgPrimary,
        borderBottom: `1px solid ${colors.border}`,
        padding: '16px 32px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            backgroundColor: colors.navy,
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: '16px'
          }}>
            D
          </div>
          <div>
            <h1 style={{
              fontSize: '18px',
              fontWeight: '600',
              color: colors.navy,
              margin: 0
            }}>
              Dispatcher AI
            </h1>
            <p style={{
              fontSize: '12px',
              color: colors.textSecondary,
              margin: 0
            }}>
              Delay Negotiation System
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <span style={{
            fontSize: '12px',
            color: colors.textSecondary,
            padding: '6px 12px',
            border: `1px solid ${colors.border}`,
            borderRadius: '4px'
          }}>
            Status: <span style={{ color: colors.navy, fontWeight: '500' }}>Negotiating</span>
          </span>
          <span style={{
            fontSize: '12px',
            color: colors.success,
            padding: '6px 12px',
            border: `1px solid ${colors.success}`,
            borderRadius: '4px',
            backgroundColor: '#F0FDF4'
          }}>
            ACCEPTABLE
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main style={{
        display: 'grid',
        gridTemplateColumns: '1fr 400px',
        gap: '24px',
        padding: '24px 32px',
        maxWidth: '1400px',
        margin: '0 auto'
      }}>
        {/* Left Column - Agent Flow */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Setup Form Card */}
          <div style={{
            backgroundColor: colors.bgPrimary,
            border: `1px solid ${colors.border}`,
            borderRadius: '6px',
            padding: '24px'
          }}>
            <h2 style={{
              fontSize: '14px',
              fontWeight: '600',
              color: colors.navy,
              marginBottom: '16px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              Shipment Details
            </h2>

            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '16px'
            }}>
              <div>
                <label style={{
                  fontSize: '12px',
                  color: colors.textSecondary,
                  display: 'block',
                  marginBottom: '4px'
                }}>
                  Original Appointment
                </label>
                <div style={{
                  padding: '10px 12px',
                  border: `1px solid ${colors.border}`,
                  borderRadius: '4px',
                  fontSize: '14px',
                  fontFamily: 'JetBrains Mono, monospace',
                  color: colors.textPrimary
                }}>
                  2024-01-15 14:00
                </div>
              </div>
              <div>
                <label style={{
                  fontSize: '12px',
                  color: colors.textSecondary,
                  display: 'block',
                  marginBottom: '4px'
                }}>
                  Delay Duration
                </label>
                <div style={{
                  padding: '10px 12px',
                  border: `1px solid ${colors.border}`,
                  borderRadius: '4px',
                  fontSize: '14px',
                  fontFamily: 'JetBrains Mono, monospace',
                  color: colors.textPrimary
                }}>
                  120 minutes
                </div>
              </div>
              <div>
                <label style={{
                  fontSize: '12px',
                  color: colors.textSecondary,
                  display: 'block',
                  marginBottom: '4px'
                }}>
                  Shipment Value
                </label>
                <div style={{
                  padding: '10px 12px',
                  border: `1px solid ${colors.border}`,
                  borderRadius: '4px',
                  fontSize: '14px',
                  fontFamily: 'JetBrains Mono, monospace',
                  color: colors.textPrimary
                }}>
                  $45,000
                </div>
              </div>
              <div>
                <label style={{
                  fontSize: '12px',
                  color: colors.textSecondary,
                  display: 'block',
                  marginBottom: '4px'
                }}>
                  Retailer
                </label>
                <div style={{
                  padding: '10px 12px',
                  border: `1px solid ${colors.border}`,
                  borderRadius: '4px',
                  fontSize: '14px',
                  color: colors.textPrimary
                }}>
                  Walmart
                </div>
              </div>
            </div>

            <button style={{
              marginTop: '20px',
              width: '100%',
              padding: '12px',
              backgroundColor: colors.navy,
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer'
            }}>
              Start Negotiation
            </button>
          </div>

          {/* Thinking/Analysis Block */}
          <div style={{
            backgroundColor: colors.bgPrimary,
            border: `1px solid ${colors.border}`,
            borderRadius: '6px',
            padding: '20px'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '12px'
            }}>
              <div style={{
                width: '20px',
                height: '20px',
                borderRadius: '4px',
                backgroundColor: colors.bgTertiary,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px'
              }}>
                i
              </div>
              <span style={{
                fontSize: '13px',
                fontWeight: '500',
                color: colors.textSecondary
              }}>
                Analysis
              </span>
            </div>
            <div style={{
              fontSize: '13px',
              color: colors.textSecondary,
              lineHeight: '1.6',
              paddingLeft: '28px'
            }}>
              <p style={{ margin: '0 0 8px 0' }}>→ Calculating cost impact of 120-minute delay</p>
              <p style={{ margin: '0 0 8px 0' }}>→ Checking Walmart chargeback policies</p>
              <p style={{ margin: '0' }}>→ Evaluating available time slots</p>
            </div>
          </div>

          {/* Strategy Panel */}
          <div style={{
            backgroundColor: colors.bgPrimary,
            border: `1px solid ${colors.border}`,
            borderRadius: '6px',
            padding: '20px'
          }}>
            <h3 style={{
              fontSize: '14px',
              fontWeight: '600',
              color: colors.navy,
              marginBottom: '16px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              Negotiation Strategy
            </h3>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '12px'
            }}>
              {/* IDEAL */}
              <div style={{
                padding: '16px',
                border: `1px solid ${colors.border}`,
                borderTop: `3px solid ${colors.success}`,
                borderRadius: '4px'
              }}>
                <div style={{
                  fontSize: '11px',
                  fontWeight: '600',
                  color: colors.success,
                  marginBottom: '8px',
                  textTransform: 'uppercase'
                }}>
                  Ideal
                </div>
                <div style={{
                  fontSize: '13px',
                  color: colors.textPrimary,
                  marginBottom: '4px'
                }}>
                  14:00 - 14:30
                </div>
                <div style={{
                  fontSize: '12px',
                  fontFamily: 'JetBrains Mono, monospace',
                  color: colors.success
                }}>
                  $0 cost
                </div>
              </div>

              {/* ACCEPTABLE */}
              <div style={{
                padding: '16px',
                border: `1px solid ${colors.border}`,
                borderTop: `3px solid ${colors.navy}`,
                borderRadius: '4px'
              }}>
                <div style={{
                  fontSize: '11px',
                  fontWeight: '600',
                  color: colors.navy,
                  marginBottom: '8px',
                  textTransform: 'uppercase'
                }}>
                  Acceptable
                </div>
                <div style={{
                  fontSize: '13px',
                  color: colors.textPrimary,
                  marginBottom: '4px'
                }}>
                  14:30 - 16:00
                </div>
                <div style={{
                  fontSize: '12px',
                  fontFamily: 'JetBrains Mono, monospace',
                  color: colors.navy
                }}>
                  ≤ $100 cost
                </div>
              </div>

              {/* PROBLEMATIC */}
              <div style={{
                padding: '16px',
                border: `1px solid ${colors.border}`,
                borderTop: `3px solid ${colors.critical}`,
                borderRadius: '4px'
              }}>
                <div style={{
                  fontSize: '11px',
                  fontWeight: '600',
                  color: colors.critical,
                  marginBottom: '8px',
                  textTransform: 'uppercase'
                }}>
                  Problematic
                </div>
                <div style={{
                  fontSize: '13px',
                  color: colors.textPrimary,
                  marginBottom: '4px'
                }}>
                  After 16:00
                </div>
                <div style={{
                  fontSize: '12px',
                  fontFamily: 'JetBrains Mono, monospace',
                  color: colors.critical
                }}>
                  $500+ cost
                </div>
              </div>
            </div>

            <div style={{
              marginTop: '16px',
              padding: '12px',
              backgroundColor: colors.bgTertiary,
              borderRadius: '4px',
              fontSize: '12px',
              color: colors.textSecondary
            }}>
              <span style={{ fontWeight: '500' }}>Truck arrival:</span>{' '}
              <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>16:00</span>
            </div>
          </div>

          {/* Cost Breakdown */}
          <div style={{
            backgroundColor: colors.bgPrimary,
            border: `1px solid ${colors.border}`,
            borderRadius: '6px',
            padding: '20px'
          }}>
            <h3 style={{
              fontSize: '14px',
              fontWeight: '600',
              color: colors.navy,
              marginBottom: '16px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              Cost Breakdown
            </h3>

            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '13px'
            }}>
              <tbody>
                <tr style={{ borderBottom: `1px solid ${colors.border}` }}>
                  <td style={{ padding: '10px 0', color: colors.textSecondary }}>Dwell Time (2 hrs @ $50/hr)</td>
                  <td style={{
                    padding: '10px 0',
                    textAlign: 'right',
                    fontFamily: 'JetBrains Mono, monospace',
                    color: colors.textPrimary
                  }}>$100.00</td>
                </tr>
                <tr style={{ borderBottom: `1px solid ${colors.border}` }}>
                  <td style={{ padding: '10px 0', color: colors.textSecondary }}>OTIF Penalty (3%)</td>
                  <td style={{
                    padding: '10px 0',
                    textAlign: 'right',
                    fontFamily: 'JetBrains Mono, monospace',
                    color: colors.textPrimary
                  }}>$0.00</td>
                </tr>
                <tr style={{ borderBottom: `1px solid ${colors.border}` }}>
                  <td style={{ padding: '10px 0', color: colors.textSecondary }}>Walmart Flat Fee</td>
                  <td style={{
                    padding: '10px 0',
                    textAlign: 'right',
                    fontFamily: 'JetBrains Mono, monospace',
                    color: colors.textPrimary
                  }}>$0.00</td>
                </tr>
                <tr>
                  <td style={{
                    padding: '12px 0',
                    fontWeight: '600',
                    color: colors.navy
                  }}>Total</td>
                  <td style={{
                    padding: '12px 0',
                    textAlign: 'right',
                    fontFamily: 'JetBrains Mono, monospace',
                    fontWeight: '600',
                    color: colors.navy,
                    fontSize: '16px'
                  }}>$100.00</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Final Agreement */}
          <div style={{
            backgroundColor: colors.bgPrimary,
            border: `1px solid ${colors.success}`,
            borderRadius: '6px',
            padding: '20px'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '16px'
            }}>
              <div style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                backgroundColor: '#F0FDF4',
                border: `1px solid ${colors.success}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: colors.success,
                fontSize: '12px'
              }}>
                ✓
              </div>
              <span style={{
                fontSize: '14px',
                fontWeight: '600',
                color: colors.success
              }}>
                Agreement Reached
              </span>
            </div>

            <div style={{
              padding: '16px',
              backgroundColor: colors.bgTertiary,
              borderRadius: '4px',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '13px',
              color: colors.textPrimary,
              lineHeight: '1.6'
            }}>
              <p style={{ margin: '0 0 8px 0' }}>New appointment: 2024-01-15 16:00</p>
              <p style={{ margin: '0 0 8px 0' }}>Dock: B-12</p>
              <p style={{ margin: '0' }}>Total cost impact: $100.00</p>
            </div>

            <button style={{
              marginTop: '16px',
              padding: '10px 16px',
              backgroundColor: colors.bgPrimary,
              color: colors.navy,
              border: `1px solid ${colors.navy}`,
              borderRadius: '4px',
              fontSize: '13px',
              fontWeight: '500',
              cursor: 'pointer'
            }}>
              Export Summary
            </button>
          </div>
        </div>

        {/* Right Column - Chat Interface */}
        <div style={{
          backgroundColor: colors.bgPrimary,
          border: `1px solid ${colors.border}`,
          borderRadius: '6px',
          display: 'flex',
          flexDirection: 'column',
          height: 'fit-content',
          position: 'sticky',
          top: '24px'
        }}>
          {/* Chat Header */}
          <div style={{
            padding: '16px 20px',
            borderBottom: `1px solid ${colors.border}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span style={{
              fontSize: '14px',
              fontWeight: '600',
              color: colors.navy
            }}>
              Negotiation Chat
            </span>
            <button style={{
              padding: '6px 12px',
              backgroundColor: colors.bgPrimary,
              color: colors.navy,
              border: `1px solid ${colors.navy}`,
              borderRadius: '4px',
              fontSize: '12px',
              cursor: 'pointer'
            }}>
              Start Voice Call
            </button>
          </div>

          {/* Messages */}
          <div style={{
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            maxHeight: '500px',
            overflowY: 'auto'
          }}>
            {/* Dispatcher Message */}
            <div style={{
              borderLeft: `3px solid ${colors.navy}`,
              paddingLeft: '12px'
            }}>
              <div style={{
                fontSize: '11px',
                color: colors.textTertiary,
                marginBottom: '4px'
              }}>
                Mike (Dispatcher)
              </div>
              <div style={{
                fontSize: '14px',
                color: colors.textPrimary,
                lineHeight: '1.5'
              }}>
                Hi, I&apos;m calling about our delivery scheduled for 2:00 PM today.
                We&apos;re running about 2 hours behind due to traffic. Can we reschedule to 4:00 PM?
              </div>
            </div>

            {/* Warehouse Message */}
            <div style={{
              borderLeft: `3px solid ${colors.tealMuted}`,
              paddingLeft: '12px',
              marginLeft: '24px'
            }}>
              <div style={{
                fontSize: '11px',
                color: colors.textTertiary,
                marginBottom: '4px'
              }}>
                Warehouse Manager
              </div>
              <div style={{
                fontSize: '14px',
                color: colors.textPrimary,
                lineHeight: '1.5'
              }}>
                Let me check our dock availability. 4:00 PM works.
                I can put you at Dock B-12.
              </div>
            </div>

            {/* Cost Badge */}
            <div style={{
              textAlign: 'center',
              padding: '8px',
              backgroundColor: colors.bgTertiary,
              borderRadius: '4px',
              fontSize: '12px',
              color: colors.textSecondary
            }}>
              Estimated cost: <span style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontWeight: '500',
                color: colors.navy
              }}>$100.00</span> (ACCEPTABLE)
            </div>

            {/* Dispatcher Message */}
            <div style={{
              borderLeft: `3px solid ${colors.navy}`,
              paddingLeft: '12px'
            }}>
              <div style={{
                fontSize: '11px',
                color: colors.textTertiary,
                marginBottom: '4px'
              }}>
                Mike (Dispatcher)
              </div>
              <div style={{
                fontSize: '14px',
                color: colors.textPrimary,
                lineHeight: '1.5'
              }}>
                Perfect, Dock B-12 at 4:00 PM. Thank you for accommodating us.
              </div>
            </div>
          </div>

          {/* Input Area */}
          <div style={{
            padding: '16px 20px',
            borderTop: `1px solid ${colors.border}`,
            display: 'flex',
            gap: '8px'
          }}>
            <input
              type="text"
              placeholder="Type a message..."
              style={{
                flex: 1,
                padding: '10px 12px',
                border: `1px solid ${colors.border}`,
                borderRadius: '4px',
                fontSize: '14px',
                outline: 'none'
              }}
            />
            <button style={{
              padding: '10px 16px',
              backgroundColor: colors.navy,
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '14px',
              cursor: 'pointer'
            }}>
              Send
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
