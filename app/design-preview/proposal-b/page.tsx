'use client';

import Link from 'next/link';

// Proposal B: Modern Professional (RECOMMENDED)
// Balanced Navy + Teal, card-based with subtle shadows
// Clean but not sterile, confident use of semantic colors
// Think: Salesforce, Stripe

export default function ProposalB() {
  // Color palette for Proposal B
  const colors = {
    navy: '#1E3A5F',
    navyLight: '#334E68',
    navyDark: '#102A43',
    teal: '#0891B2',
    tealLight: '#22D3EE',
    tealBg: '#F0FDFA',
    success: '#10B981',
    successBg: '#ECFDF5',
    warning: '#F59E0B',
    warningBg: '#FFFBEB',
    critical: '#EF4444',
    criticalBg: '#FEF2F2',
    bgPrimary: '#FFFFFF',
    bgSecondary: '#F8FAFC',
    bgTertiary: '#F1F5F9',
    border: '#E2E8F0',
    borderLight: '#F1F5F9',
    textPrimary: '#1E293B',
    textSecondary: '#64748B',
    textTertiary: '#94A3B8',
    shadow: '0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)',
    shadowMd: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)',
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
          color: colors.teal,
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
          color: colors.bgPrimary,
          backgroundColor: colors.teal,
          padding: '4px 12px',
          borderRadius: '4px',
          fontWeight: '500'
        }}>
          Proposal B: Modern Professional (Recommended)
        </span>
      </div>

      {/* Header */}
      <header style={{
        backgroundColor: colors.bgPrimary,
        boxShadow: colors.shadow,
        padding: '16px 32px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '44px',
            height: '44px',
            backgroundColor: colors.navy,
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: '18px',
            fontWeight: '600',
            boxShadow: colors.shadow
          }}>
            D
          </div>
          <div>
            <h1 style={{
              fontSize: '20px',
              fontWeight: '600',
              color: colors.navy,
              margin: 0
            }}>
              Dispatcher AI
            </h1>
            <p style={{
              fontSize: '13px',
              color: colors.textSecondary,
              margin: 0
            }}>
              Intelligent Delay Negotiation
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            backgroundColor: colors.bgTertiary,
            borderRadius: '8px'
          }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: colors.teal,
              animation: 'pulse 2s infinite'
            }} />
            <span style={{
              fontSize: '13px',
              color: colors.textSecondary
            }}>
              <span style={{ fontWeight: '500', color: colors.navy }}>Negotiating</span>
            </span>
          </div>
          <div style={{
            padding: '8px 16px',
            backgroundColor: colors.successBg,
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <span style={{
              fontSize: '13px',
              fontWeight: '600',
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
        gridTemplateColumns: '1fr 420px',
        gap: '24px',
        padding: '24px 32px',
        maxWidth: '1400px',
        margin: '0 auto'
      }}>
        {/* Left Column - Agent Flow */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Setup Form Card */}
          <div style={{
            backgroundColor: colors.bgPrimary,
            borderRadius: '12px',
            padding: '24px',
            boxShadow: colors.shadow
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              marginBottom: '20px'
            }}>
              <div style={{
                width: '32px',
                height: '32px',
                backgroundColor: colors.tealBg,
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: colors.teal,
                fontSize: '16px'
              }}>
                📦
              </div>
              <h2 style={{
                fontSize: '16px',
                fontWeight: '600',
                color: colors.navy,
                margin: 0
              }}>
                Shipment Details
              </h2>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '16px'
            }}>
              <div>
                <label style={{
                  fontSize: '12px',
                  fontWeight: '500',
                  color: colors.textSecondary,
                  display: 'block',
                  marginBottom: '6px'
                }}>
                  Original Appointment
                </label>
                <div style={{
                  padding: '12px 14px',
                  backgroundColor: colors.bgSecondary,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontFamily: 'JetBrains Mono, monospace',
                  color: colors.navy
                }}>
                  2024-01-15 14:00
                </div>
              </div>
              <div>
                <label style={{
                  fontSize: '12px',
                  fontWeight: '500',
                  color: colors.textSecondary,
                  display: 'block',
                  marginBottom: '6px'
                }}>
                  Delay Duration
                </label>
                <div style={{
                  padding: '12px 14px',
                  backgroundColor: colors.bgSecondary,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontFamily: 'JetBrains Mono, monospace',
                  color: colors.navy
                }}>
                  120 minutes
                </div>
              </div>
              <div>
                <label style={{
                  fontSize: '12px',
                  fontWeight: '500',
                  color: colors.textSecondary,
                  display: 'block',
                  marginBottom: '6px'
                }}>
                  Shipment Value
                </label>
                <div style={{
                  padding: '12px 14px',
                  backgroundColor: colors.bgSecondary,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontFamily: 'JetBrains Mono, monospace',
                  color: colors.navy
                }}>
                  $45,000
                </div>
              </div>
              <div>
                <label style={{
                  fontSize: '12px',
                  fontWeight: '500',
                  color: colors.textSecondary,
                  display: 'block',
                  marginBottom: '6px'
                }}>
                  Retailer
                </label>
                <div style={{
                  padding: '12px 14px',
                  backgroundColor: colors.navy,
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: 'white'
                }}>
                  Walmart
                </div>
              </div>
            </div>

            <button style={{
              marginTop: '24px',
              width: '100%',
              padding: '14px',
              backgroundColor: colors.navy,
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              boxShadow: colors.shadow,
              transition: 'all 0.2s ease'
            }}>
              Start Negotiation
            </button>
          </div>

          {/* Thinking/Analysis Block */}
          <div style={{
            backgroundColor: colors.bgPrimary,
            borderRadius: '12px',
            padding: '20px',
            boxShadow: colors.shadow,
            borderLeft: `4px solid ${colors.teal}`
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              marginBottom: '16px'
            }}>
              <div style={{
                width: '28px',
                height: '28px',
                borderRadius: '6px',
                backgroundColor: colors.tealBg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: colors.teal,
                fontSize: '14px'
              }}>
                🔍
              </div>
              <span style={{
                fontSize: '14px',
                fontWeight: '600',
                color: colors.navy
              }}>
                Analysis in Progress
              </span>
            </div>
            <div style={{
              fontSize: '13px',
              color: colors.textSecondary,
              lineHeight: '1.7',
              paddingLeft: '38px'
            }}>
              <p style={{ margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: colors.teal }}>→</span> Calculating cost impact of 120-minute delay
              </p>
              <p style={{ margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: colors.teal }}>→</span> Checking Walmart chargeback policies
              </p>
              <p style={{ margin: '0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: colors.teal }}>→</span> Evaluating available time slots
              </p>
            </div>
          </div>

          {/* Strategy Panel */}
          <div style={{
            backgroundColor: colors.bgPrimary,
            borderRadius: '12px',
            padding: '24px',
            boxShadow: colors.shadow
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              marginBottom: '20px'
            }}>
              <div style={{
                width: '32px',
                height: '32px',
                backgroundColor: `${colors.navy}15`,
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: colors.navy,
                fontSize: '16px'
              }}>
                📊
              </div>
              <h3 style={{
                fontSize: '16px',
                fontWeight: '600',
                color: colors.navy,
                margin: 0
              }}>
                Negotiation Strategy
              </h3>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '16px'
            }}>
              {/* IDEAL */}
              <div style={{
                padding: '20px 16px',
                backgroundColor: colors.successBg,
                borderRadius: '10px',
                border: `1px solid ${colors.success}20`
              }}>
                <div style={{
                  fontSize: '11px',
                  fontWeight: '700',
                  color: colors.success,
                  marginBottom: '10px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>
                  Ideal
                </div>
                <div style={{
                  fontSize: '14px',
                  fontWeight: '500',
                  color: colors.textPrimary,
                  marginBottom: '6px'
                }}>
                  14:00 - 14:30
                </div>
                <div style={{
                  fontSize: '16px',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontWeight: '600',
                  color: colors.success
                }}>
                  $0
                </div>
              </div>

              {/* ACCEPTABLE */}
              <div style={{
                padding: '20px 16px',
                backgroundColor: colors.tealBg,
                borderRadius: '10px',
                border: `1px solid ${colors.teal}20`
              }}>
                <div style={{
                  fontSize: '11px',
                  fontWeight: '700',
                  color: colors.teal,
                  marginBottom: '10px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>
                  Acceptable
                </div>
                <div style={{
                  fontSize: '14px',
                  fontWeight: '500',
                  color: colors.textPrimary,
                  marginBottom: '6px'
                }}>
                  14:30 - 16:00
                </div>
                <div style={{
                  fontSize: '16px',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontWeight: '600',
                  color: colors.teal
                }}>
                  ≤ $100
                </div>
              </div>

              {/* PROBLEMATIC */}
              <div style={{
                padding: '20px 16px',
                backgroundColor: colors.criticalBg,
                borderRadius: '10px',
                border: `1px solid ${colors.critical}20`
              }}>
                <div style={{
                  fontSize: '11px',
                  fontWeight: '700',
                  color: colors.critical,
                  marginBottom: '10px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>
                  Problematic
                </div>
                <div style={{
                  fontSize: '14px',
                  fontWeight: '500',
                  color: colors.textPrimary,
                  marginBottom: '6px'
                }}>
                  After 16:00
                </div>
                <div style={{
                  fontSize: '16px',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontWeight: '600',
                  color: colors.critical
                }}>
                  $500+
                </div>
              </div>
            </div>

            <div style={{
              marginTop: '20px',
              padding: '14px 16px',
              backgroundColor: colors.bgSecondary,
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <span style={{ fontSize: '13px', color: colors.textSecondary }}>
                Truck arrival estimate
              </span>
              <span style={{
                fontSize: '14px',
                fontFamily: 'JetBrains Mono, monospace',
                fontWeight: '600',
                color: colors.navy
              }}>
                16:00
              </span>
            </div>
          </div>

          {/* Cost Breakdown */}
          <div style={{
            backgroundColor: colors.bgPrimary,
            borderRadius: '12px',
            padding: '24px',
            boxShadow: colors.shadow
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              marginBottom: '20px'
            }}>
              <div style={{
                width: '32px',
                height: '32px',
                backgroundColor: colors.warningBg,
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: colors.warning,
                fontSize: '16px'
              }}>
                💰
              </div>
              <h3 style={{
                fontSize: '16px',
                fontWeight: '600',
                color: colors.navy,
                margin: 0
              }}>
                Cost Breakdown
              </h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 0',
                borderBottom: `1px solid ${colors.borderLight}`
              }}>
                <span style={{ fontSize: '14px', color: colors.textSecondary }}>
                  Dwell Time (2 hrs @ $50/hr)
                </span>
                <span style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '14px',
                  color: colors.textPrimary
                }}>
                  $100.00
                </span>
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 0',
                borderBottom: `1px solid ${colors.borderLight}`
              }}>
                <span style={{ fontSize: '14px', color: colors.textSecondary }}>
                  OTIF Penalty (3%)
                </span>
                <span style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '14px',
                  color: colors.success
                }}>
                  $0.00
                </span>
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 0',
                borderBottom: `1px solid ${colors.borderLight}`
              }}>
                <span style={{ fontSize: '14px', color: colors.textSecondary }}>
                  Walmart Flat Fee
                </span>
                <span style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '14px',
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
                backgroundColor: colors.bgSecondary,
                borderRadius: '8px',
                marginTop: '4px'
              }}>
                <span style={{
                  fontSize: '15px',
                  fontWeight: '600',
                  color: colors.navy
                }}>
                  Total Cost Impact
                </span>
                <span style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '20px',
                  fontWeight: '700',
                  color: colors.navy
                }}>
                  $100.00
                </span>
              </div>
            </div>
          </div>

          {/* Final Agreement */}
          <div style={{
            backgroundColor: colors.bgPrimary,
            borderRadius: '12px',
            padding: '24px',
            boxShadow: colors.shadow,
            borderLeft: `4px solid ${colors.success}`
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '20px'
            }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                backgroundColor: colors.successBg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: colors.success,
                fontSize: '18px'
              }}>
                ✓
              </div>
              <div>
                <span style={{
                  fontSize: '16px',
                  fontWeight: '600',
                  color: colors.success,
                  display: 'block'
                }}>
                  Agreement Reached
                </span>
                <span style={{
                  fontSize: '12px',
                  color: colors.textSecondary
                }}>
                  Negotiation completed successfully
                </span>
              </div>
            </div>

            <div style={{
              padding: '20px',
              backgroundColor: colors.bgSecondary,
              borderRadius: '10px',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '14px',
              color: colors.textPrimary,
              lineHeight: '1.8'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: colors.textSecondary }}>New appointment:</span>
                <span style={{ fontWeight: '500' }}>2024-01-15 16:00</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: colors.textSecondary }}>Assigned dock:</span>
                <span style={{ fontWeight: '500' }}>B-12</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: colors.textSecondary }}>Total cost impact:</span>
                <span style={{ fontWeight: '600', color: colors.navy }}>$100.00</span>
              </div>
            </div>

            <div style={{
              display: 'flex',
              gap: '12px',
              marginTop: '20px'
            }}>
              <button style={{
                flex: 1,
                padding: '12px',
                backgroundColor: colors.navy,
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer'
              }}>
                Export Summary
              </button>
              <button style={{
                padding: '12px 20px',
                backgroundColor: colors.bgPrimary,
                color: colors.navy,
                border: `1px solid ${colors.navy}`,
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer'
              }}>
                New Negotiation
              </button>
            </div>
          </div>
        </div>

        {/* Right Column - Chat Interface */}
        <div style={{
          backgroundColor: colors.bgPrimary,
          borderRadius: '12px',
          display: 'flex',
          flexDirection: 'column',
          height: 'fit-content',
          position: 'sticky',
          top: '24px',
          boxShadow: colors.shadow,
          overflow: 'hidden'
        }}>
          {/* Chat Header */}
          <div style={{
            padding: '20px 24px',
            borderBottom: `1px solid ${colors.border}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: colors.bgSecondary
          }}>
            <div>
              <span style={{
                fontSize: '16px',
                fontWeight: '600',
                color: colors.navy,
                display: 'block'
              }}>
                Negotiation Chat
              </span>
              <span style={{
                fontSize: '12px',
                color: colors.textSecondary
              }}>
                With Warehouse Manager
              </span>
            </div>
            <button style={{
              padding: '10px 16px',
              backgroundColor: colors.teal,
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '500',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <span>🎤</span> Voice Call
            </button>
          </div>

          {/* Messages */}
          <div style={{
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            maxHeight: '480px',
            overflowY: 'auto'
          }}>
            {/* Dispatcher Message */}
            <div style={{
              display: 'flex',
              gap: '12px'
            }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: colors.navy,
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                fontWeight: '600',
                flexShrink: 0
              }}>
                M
              </div>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: '12px',
                  color: colors.textSecondary,
                  marginBottom: '6px'
                }}>
                  <span style={{ fontWeight: '500', color: colors.navy }}>Mike</span> · Dispatcher
                </div>
                <div style={{
                  padding: '14px 16px',
                  backgroundColor: colors.bgSecondary,
                  borderRadius: '12px',
                  borderTopLeftRadius: '4px',
                  fontSize: '14px',
                  color: colors.textPrimary,
                  lineHeight: '1.6'
                }}>
                  Hi, I&apos;m calling about our delivery scheduled for 2:00 PM today.
                  We&apos;re running about 2 hours behind due to traffic. Can we reschedule to 4:00 PM?
                </div>
              </div>
            </div>

            {/* Warehouse Message */}
            <div style={{
              display: 'flex',
              gap: '12px',
              flexDirection: 'row-reverse'
            }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: colors.teal,
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                fontWeight: '600',
                flexShrink: 0
              }}>
                W
              </div>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: '12px',
                  color: colors.textSecondary,
                  marginBottom: '6px',
                  textAlign: 'right'
                }}>
                  <span style={{ fontWeight: '500', color: colors.teal }}>Warehouse</span> · Manager
                </div>
                <div style={{
                  padding: '14px 16px',
                  backgroundColor: colors.tealBg,
                  borderRadius: '12px',
                  borderTopRightRadius: '4px',
                  fontSize: '14px',
                  color: colors.textPrimary,
                  lineHeight: '1.6'
                }}>
                  Let me check our dock availability. 4:00 PM works.
                  I can put you at Dock B-12.
                </div>
              </div>
            </div>

            {/* Cost Badge */}
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              padding: '8px 0'
            }}>
              <div style={{
                padding: '10px 20px',
                backgroundColor: colors.tealBg,
                borderRadius: '20px',
                fontSize: '13px',
                color: colors.teal,
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span>💰</span>
                <span>Est. cost:</span>
                <span style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontWeight: '600'
                }}>$100.00</span>
                <span style={{
                  backgroundColor: colors.teal,
                  color: 'white',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: '600'
                }}>ACCEPTABLE</span>
              </div>
            </div>

            {/* Dispatcher Message */}
            <div style={{
              display: 'flex',
              gap: '12px'
            }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: colors.navy,
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                fontWeight: '600',
                flexShrink: 0
              }}>
                M
              </div>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: '12px',
                  color: colors.textSecondary,
                  marginBottom: '6px'
                }}>
                  <span style={{ fontWeight: '500', color: colors.navy }}>Mike</span> · Dispatcher
                </div>
                <div style={{
                  padding: '14px 16px',
                  backgroundColor: colors.bgSecondary,
                  borderRadius: '12px',
                  borderTopLeftRadius: '4px',
                  fontSize: '14px',
                  color: colors.textPrimary,
                  lineHeight: '1.6'
                }}>
                  Perfect, Dock B-12 at 4:00 PM. Thank you for accommodating us.
                </div>
              </div>
            </div>
          </div>

          {/* Input Area */}
          <div style={{
            padding: '20px 24px',
            borderTop: `1px solid ${colors.border}`,
            display: 'flex',
            gap: '12px',
            backgroundColor: colors.bgPrimary
          }}>
            <input
              type="text"
              placeholder="Type a message..."
              style={{
                flex: 1,
                padding: '14px 16px',
                backgroundColor: colors.bgSecondary,
                border: `1px solid ${colors.border}`,
                borderRadius: '10px',
                fontSize: '14px',
                outline: 'none',
                transition: 'border-color 0.2s ease'
              }}
            />
            <button style={{
              padding: '14px 24px',
              backgroundColor: colors.navy,
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              fontSize: '14px',
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
