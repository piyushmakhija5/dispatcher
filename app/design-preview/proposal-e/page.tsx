'use client';

import Link from 'next/link';

// Proposal E: Carbon (Vercel/Stripe inspired)
// Soft black base with minimal white/blue accent
// Ultra-clean, minimal, modern tech aesthetic
// Think: Vercel, Stripe, GitHub dark

export default function ProposalE() {
  // Color palette - Carbon
  const colors = {
    // Backgrounds - soft black
    bgBase: '#0a0a0a',
    bgSurface1: '#111111',
    bgSurface2: '#171717',
    bgSurface3: '#1f1f1f',
    bgHover: '#262626',

    // Borders
    border: '#262626',
    borderLight: '#333333',
    borderSubtle: '#1a1a1a',

    // Text
    textPrimary: '#EDEDED',
    textSecondary: '#888888',
    textTertiary: '#666666',
    textMuted: '#444444',

    // Accent - Clean blue (minimal use)
    accent: '#0070F3',
    accentLight: '#3291FF',
    accentBg: 'rgba(0, 112, 243, 0.1)',
    accentBorder: 'rgba(0, 112, 243, 0.25)',

    // Semantic
    success: '#50E3C2',
    successDark: '#0D9373',
    successBg: 'rgba(80, 227, 194, 0.1)',
    successBorder: 'rgba(80, 227, 194, 0.2)',
    warning: '#F5A623',
    warningBg: 'rgba(245, 166, 35, 0.1)',
    warningBorder: 'rgba(245, 166, 35, 0.2)',
    critical: '#E00',
    criticalBg: 'rgba(238, 0, 0, 0.1)',
    criticalBorder: 'rgba(238, 0, 0, 0.2)',
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: colors.bgBase,
      fontFamily: 'Inter, system-ui, sans-serif',
      color: colors.textPrimary
    }}>
      {/* Navigation */}
      <div style={{
        backgroundColor: 'transparent',
        borderBottom: `1px solid ${colors.border}`,
        padding: '12px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <Link href="/design-preview" style={{
          color: colors.textSecondary,
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
          color: colors.textPrimary,
          backgroundColor: colors.bgSurface2,
          border: `1px solid ${colors.border}`,
          padding: '6px 14px',
          borderRadius: '6px',
          fontWeight: '500'
        }}>
          Proposal E: Carbon
        </span>
      </div>

      {/* Header */}
      <header style={{
        borderBottom: `1px solid ${colors.border}`,
        padding: '20px 32px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            backgroundColor: colors.textPrimary,
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: colors.bgBase,
            fontSize: '16px',
            fontWeight: '700'
          }}>
            D
          </div>
          <div>
            <h1 style={{
              fontSize: '16px',
              fontWeight: '500',
              color: colors.textPrimary,
              margin: 0
            }}>
              Dispatcher AI
            </h1>
            <p style={{
              fontSize: '13px',
              color: colors.textTertiary,
              margin: 0
            }}>
              Delay Negotiation
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 12px',
            borderRadius: '6px',
            border: `1px solid ${colors.border}`
          }}>
            <div style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: colors.success
            }} />
            <span style={{
              fontSize: '13px',
              color: colors.textSecondary
            }}>
              Negotiating
            </span>
          </div>
          <div style={{
            padding: '6px 12px',
            backgroundColor: colors.successBg,
            borderRadius: '6px',
            border: `1px solid ${colors.successBorder}`
          }}>
            <span style={{
              fontSize: '12px',
              fontWeight: '500',
              color: colors.success
            }}>
              ACCEPTABLE
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main style={{
        display: 'grid',
        gridTemplateColumns: '1fr 400px',
        gap: '1px',
        backgroundColor: colors.border,
        maxWidth: '1400px',
        margin: '0 auto'
      }}>
        {/* Left Column - Agent Flow */}
        <div style={{
          backgroundColor: colors.bgBase,
          padding: '24px 32px',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px'
        }}>

          {/* Setup Form Card */}
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '16px'
            }}>
              <span style={{
                fontSize: '13px',
                fontWeight: '500',
                color: colors.textPrimary
              }}>
                Shipment Details
              </span>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '12px'
            }}>
              <div>
                <label style={{
                  fontSize: '12px',
                  color: colors.textTertiary,
                  display: 'block',
                  marginBottom: '6px'
                }}>
                  Original Appointment
                </label>
                <div style={{
                  padding: '10px 12px',
                  backgroundColor: colors.bgSurface1,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontFamily: 'JetBrains Mono, monospace',
                  color: colors.textPrimary
                }}>
                  2024-01-15 14:00
                </div>
              </div>
              <div>
                <label style={{
                  fontSize: '12px',
                  color: colors.textTertiary,
                  display: 'block',
                  marginBottom: '6px'
                }}>
                  Delay Duration
                </label>
                <div style={{
                  padding: '10px 12px',
                  backgroundColor: colors.warningBg,
                  border: `1px solid ${colors.warningBorder}`,
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontFamily: 'JetBrains Mono, monospace',
                  color: colors.warning
                }}>
                  120 minutes
                </div>
              </div>
              <div>
                <label style={{
                  fontSize: '12px',
                  color: colors.textTertiary,
                  display: 'block',
                  marginBottom: '6px'
                }}>
                  Shipment Value
                </label>
                <div style={{
                  padding: '10px 12px',
                  backgroundColor: colors.bgSurface1,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontFamily: 'JetBrains Mono, monospace',
                  color: colors.textPrimary
                }}>
                  $45,000
                </div>
              </div>
              <div>
                <label style={{
                  fontSize: '12px',
                  color: colors.textTertiary,
                  display: 'block',
                  marginBottom: '6px'
                }}>
                  Retailer
                </label>
                <div style={{
                  padding: '10px 12px',
                  backgroundColor: colors.textPrimary,
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: '500',
                  color: colors.bgBase
                }}>
                  Walmart
                </div>
              </div>
            </div>

            <button style={{
              marginTop: '20px',
              width: '100%',
              padding: '12px',
              backgroundColor: colors.textPrimary,
              color: colors.bgBase,
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer'
            }}>
              Start Negotiation
            </button>
          </div>

          {/* Divider */}
          <div style={{ height: '1px', backgroundColor: colors.border }} />

          {/* Thinking/Analysis Block */}
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '12px'
            }}>
              <span style={{
                fontSize: '13px',
                fontWeight: '500',
                color: colors.textPrimary
              }}>
                Analysis
              </span>
              <span style={{
                fontSize: '11px',
                color: colors.textTertiary,
                backgroundColor: colors.bgSurface2,
                padding: '2px 8px',
                borderRadius: '4px'
              }}>
                processing
              </span>
            </div>
            <div style={{
              fontSize: '13px',
              color: colors.textSecondary,
              lineHeight: '2'
            }}>
              <p style={{ margin: '0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: colors.textTertiary }}>1.</span>
                Calculating cost impact of 120-minute delay
              </p>
              <p style={{ margin: '0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: colors.textTertiary }}>2.</span>
                Checking Walmart chargeback policies
              </p>
              <p style={{ margin: '0', display: 'flex', alignItems: 'center', gap: '8px', color: colors.textPrimary }}>
                <span style={{ color: colors.accent }}>3.</span>
                Evaluating available time slots
              </p>
            </div>
          </div>

          {/* Divider */}
          <div style={{ height: '1px', backgroundColor: colors.border }} />

          {/* Strategy Panel */}
          <div>
            <div style={{
              fontSize: '13px',
              fontWeight: '500',
              color: colors.textPrimary,
              marginBottom: '16px'
            }}>
              Strategy
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '1px',
              backgroundColor: colors.border,
              borderRadius: '8px',
              overflow: 'hidden'
            }}>
              {/* IDEAL */}
              <div style={{
                padding: '16px',
                backgroundColor: colors.bgSurface1
              }}>
                <div style={{
                  fontSize: '11px',
                  fontWeight: '500',
                  color: colors.success,
                  marginBottom: '8px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>
                  Ideal
                </div>
                <div style={{
                  fontSize: '13px',
                  color: colors.textSecondary,
                  marginBottom: '4px'
                }}>
                  14:00 - 14:30
                </div>
                <div style={{
                  fontSize: '18px',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontWeight: '600',
                  color: colors.success
                }}>
                  $0
                </div>
              </div>

              {/* ACCEPTABLE */}
              <div style={{
                padding: '16px',
                backgroundColor: colors.bgSurface1
              }}>
                <div style={{
                  fontSize: '11px',
                  fontWeight: '500',
                  color: colors.accent,
                  marginBottom: '8px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>
                  Acceptable
                </div>
                <div style={{
                  fontSize: '13px',
                  color: colors.textSecondary,
                  marginBottom: '4px'
                }}>
                  14:30 - 16:00
                </div>
                <div style={{
                  fontSize: '18px',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontWeight: '600',
                  color: colors.accent
                }}>
                  ≤$100
                </div>
              </div>

              {/* PROBLEMATIC */}
              <div style={{
                padding: '16px',
                backgroundColor: colors.bgSurface1
              }}>
                <div style={{
                  fontSize: '11px',
                  fontWeight: '500',
                  color: colors.critical,
                  marginBottom: '8px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>
                  Problematic
                </div>
                <div style={{
                  fontSize: '13px',
                  color: colors.textSecondary,
                  marginBottom: '4px'
                }}>
                  After 16:00
                </div>
                <div style={{
                  fontSize: '18px',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontWeight: '600',
                  color: colors.critical
                }}>
                  $500+
                </div>
              </div>
            </div>

            <div style={{
              marginTop: '12px',
              padding: '12px',
              backgroundColor: colors.bgSurface1,
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              border: `1px solid ${colors.border}`
            }}>
              <span style={{ fontSize: '12px', color: colors.textTertiary }}>
                Truck arrival
              </span>
              <span style={{
                fontSize: '14px',
                fontFamily: 'JetBrains Mono, monospace',
                fontWeight: '500',
                color: colors.textPrimary
              }}>
                16:00
              </span>
            </div>
          </div>

          {/* Divider */}
          <div style={{ height: '1px', backgroundColor: colors.border }} />

          {/* Cost Breakdown */}
          <div>
            <div style={{
              fontSize: '13px',
              fontWeight: '500',
              color: colors.textPrimary,
              marginBottom: '16px'
            }}>
              Cost Breakdown
            </div>

            <div style={{
              border: `1px solid ${colors.border}`,
              borderRadius: '8px',
              overflow: 'hidden'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 16px',
                borderBottom: `1px solid ${colors.border}`
              }}>
                <span style={{ fontSize: '13px', color: colors.textSecondary }}>
                  Dwell Time (2 hrs @ $50/hr)
                </span>
                <span style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '13px',
                  color: colors.textPrimary
                }}>
                  $100.00
                </span>
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 16px',
                borderBottom: `1px solid ${colors.border}`
              }}>
                <span style={{ fontSize: '13px', color: colors.textSecondary }}>
                  OTIF Penalty
                </span>
                <span style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '13px',
                  color: colors.success
                }}>
                  $0.00
                </span>
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 16px',
                borderBottom: `1px solid ${colors.border}`
              }}>
                <span style={{ fontSize: '13px', color: colors.textSecondary }}>
                  Walmart Flat Fee
                </span>
                <span style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '13px',
                  color: colors.success
                }}>
                  $0.00
                </span>
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '16px',
                backgroundColor: colors.bgSurface1
              }}>
                <span style={{
                  fontSize: '14px',
                  fontWeight: '500',
                  color: colors.textPrimary
                }}>
                  Total
                </span>
                <span style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '20px',
                  fontWeight: '600',
                  color: colors.textPrimary
                }}>
                  $100
                </span>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div style={{ height: '1px', backgroundColor: colors.border }} />

          {/* Final Agreement */}
          <div style={{
            padding: '20px',
            backgroundColor: colors.bgSurface1,
            borderRadius: '8px',
            border: `1px solid ${colors.successBorder}`
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              marginBottom: '16px'
            }}>
              <div style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                backgroundColor: colors.success,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: colors.bgBase,
                fontSize: '14px'
              }}>
                ✓
              </div>
              <span style={{
                fontSize: '14px',
                fontWeight: '500',
                color: colors.success
              }}>
                Agreement Reached
              </span>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '16px',
              marginBottom: '16px'
            }}>
              <div>
                <div style={{
                  fontSize: '11px',
                  color: colors.textTertiary,
                  marginBottom: '4px'
                }}>
                  New Time
                </div>
                <div style={{
                  fontSize: '14px',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontWeight: '500',
                  color: colors.textPrimary
                }}>
                  16:00
                </div>
              </div>
              <div>
                <div style={{
                  fontSize: '11px',
                  color: colors.textTertiary,
                  marginBottom: '4px'
                }}>
                  Dock
                </div>
                <div style={{
                  fontSize: '14px',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontWeight: '500',
                  color: colors.textPrimary
                }}>
                  B-12
                </div>
              </div>
              <div>
                <div style={{
                  fontSize: '11px',
                  color: colors.textTertiary,
                  marginBottom: '4px'
                }}>
                  Cost
                </div>
                <div style={{
                  fontSize: '14px',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontWeight: '500',
                  color: colors.textPrimary
                }}>
                  $100.00
                </div>
              </div>
            </div>

            <div style={{
              display: 'flex',
              gap: '8px'
            }}>
              <button style={{
                flex: 1,
                padding: '10px',
                backgroundColor: colors.textPrimary,
                color: colors.bgBase,
                border: 'none',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: '500',
                cursor: 'pointer'
              }}>
                Export
              </button>
              <button style={{
                padding: '10px 16px',
                backgroundColor: 'transparent',
                color: colors.textSecondary,
                border: `1px solid ${colors.border}`,
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: '500',
                cursor: 'pointer'
              }}>
                New
              </button>
            </div>
          </div>
        </div>

        {/* Right Column - Chat Interface */}
        <div style={{
          backgroundColor: colors.bgSurface1,
          display: 'flex',
          flexDirection: 'column',
          height: 'fit-content',
          position: 'sticky',
          top: '0'
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
              fontWeight: '500',
              color: colors.textPrimary
            }}>
              Chat
            </span>
            <button style={{
              padding: '8px 14px',
              backgroundColor: colors.textPrimary,
              color: colors.bgBase,
              border: 'none',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: '500',
              cursor: 'pointer'
            }}>
              Voice Call
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
            <div>
              <div style={{
                fontSize: '11px',
                color: colors.textTertiary,
                marginBottom: '6px'
              }}>
                Mike · Dispatcher
              </div>
              <div style={{
                padding: '12px 14px',
                backgroundColor: colors.bgSurface2,
                border: `1px solid ${colors.border}`,
                borderRadius: '8px',
                borderTopLeftRadius: '2px',
                fontSize: '13px',
                color: colors.textPrimary,
                lineHeight: '1.6'
              }}>
                Hi, I&apos;m calling about our delivery scheduled for 2:00 PM today.
                We&apos;re running about 2 hours behind. Can we reschedule to 4:00 PM?
              </div>
            </div>

            {/* Warehouse Message */}
            <div style={{ textAlign: 'right' }}>
              <div style={{
                fontSize: '11px',
                color: colors.textTertiary,
                marginBottom: '6px'
              }}>
                Warehouse · Manager
              </div>
              <div style={{
                padding: '12px 14px',
                backgroundColor: colors.bgHover,
                borderRadius: '8px',
                borderTopRightRadius: '2px',
                fontSize: '13px',
                color: colors.textPrimary,
                lineHeight: '1.6',
                display: 'inline-block',
                textAlign: 'left'
              }}>
                Let me check our dock availability. 4:00 PM works.
                I can put you at Dock B-12.
              </div>
            </div>

            {/* Cost Badge */}
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              padding: '8px 0'
            }}>
              <div style={{
                padding: '8px 16px',
                backgroundColor: colors.bgSurface2,
                border: `1px solid ${colors.border}`,
                borderRadius: '16px',
                fontSize: '12px',
                color: colors.textSecondary,
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  color: colors.textPrimary
                }}>$100</span>
                <span style={{
                  color: colors.success,
                  fontSize: '11px',
                  fontWeight: '500'
                }}>ACCEPTABLE</span>
              </div>
            </div>

            {/* Dispatcher Message */}
            <div>
              <div style={{
                fontSize: '11px',
                color: colors.textTertiary,
                marginBottom: '6px'
              }}>
                Mike · Dispatcher
              </div>
              <div style={{
                padding: '12px 14px',
                backgroundColor: colors.bgSurface2,
                border: `1px solid ${colors.border}`,
                borderRadius: '8px',
                borderTopLeftRadius: '2px',
                fontSize: '13px',
                color: colors.textPrimary,
                lineHeight: '1.6'
              }}>
                Perfect, Dock B-12 at 4:00 PM. Thank you!
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
              placeholder="Message..."
              style={{
                flex: 1,
                padding: '10px 12px',
                backgroundColor: colors.bgSurface2,
                border: `1px solid ${colors.border}`,
                borderRadius: '6px',
                fontSize: '13px',
                color: colors.textPrimary,
                outline: 'none'
              }}
            />
            <button style={{
              padding: '10px 16px',
              backgroundColor: colors.textPrimary,
              color: colors.bgBase,
              border: 'none',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: '500',
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
