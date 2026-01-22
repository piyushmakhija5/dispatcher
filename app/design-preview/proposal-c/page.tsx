'use client';

import Link from 'next/link';

// Proposal C: Premium Tech
// Bolder contrast, elevated cards with stronger shadows
// More visual weight, prominent interactive states
// Think: Flexport, modern logistics startups

export default function ProposalC() {
  // Color palette for Proposal C - Bolder, more contrast
  const colors = {
    navy: '#102A43', // Deeper navy
    navyMid: '#1E3A5F',
    navyLight: '#334E68',
    teal: '#0891B2',
    tealBright: '#06B6D4',
    tealBg: '#ECFEFF',
    success: '#059669',
    successBright: '#10B981',
    successBg: '#D1FAE5',
    warning: '#D97706',
    warningBright: '#F59E0B',
    warningBg: '#FEF3C7',
    critical: '#DC2626',
    criticalBright: '#EF4444',
    criticalBg: '#FEE2E2',
    bgPrimary: '#FFFFFF',
    bgSecondary: '#F8FAFC',
    bgTertiary: '#F1F5F9',
    bgDark: '#0F172A',
    border: '#CBD5E1',
    borderLight: '#E2E8F0',
    textPrimary: '#0F172A',
    textSecondary: '#475569',
    textTertiary: '#94A3B8',
    shadowSm: '0 1px 2px rgba(0,0,0,0.05)',
    shadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)',
    shadowLg: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)',
    shadowXl: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: colors.bgTertiary,
      fontFamily: 'Inter, system-ui, sans-serif'
    }}>
      {/* Navigation */}
      <div style={{
        backgroundColor: colors.navy,
        padding: '12px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <Link href="/design-preview" style={{
          color: colors.tealBright,
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
          color: colors.navy,
          backgroundColor: colors.tealBright,
          padding: '6px 14px',
          borderRadius: '6px',
          fontWeight: '600'
        }}>
          Proposal C: Premium Tech
        </span>
      </div>

      {/* Header - Dark */}
      <header style={{
        backgroundColor: colors.navy,
        padding: '20px 32px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: colors.shadowLg
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            background: `linear-gradient(135deg, ${colors.teal}, ${colors.tealBright})`,
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: '20px',
            fontWeight: '700',
            boxShadow: '0 4px 14px rgba(8, 145, 178, 0.4)'
          }}>
            D
          </div>
          <div>
            <h1 style={{
              fontSize: '22px',
              fontWeight: '700',
              color: 'white',
              margin: 0,
              letterSpacing: '-0.02em'
            }}>
              Dispatcher AI
            </h1>
            <p style={{
              fontSize: '13px',
              color: colors.textTertiary,
              margin: 0
            }}>
              Intelligent Delay Negotiation Platform
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '10px 18px',
            backgroundColor: 'rgba(255,255,255,0.1)',
            borderRadius: '10px',
            backdropFilter: 'blur(10px)'
          }}>
            <div style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              backgroundColor: colors.tealBright,
              boxShadow: `0 0 10px ${colors.tealBright}`
            }} />
            <span style={{
              fontSize: '14px',
              color: 'white',
              fontWeight: '500'
            }}>
              Negotiating
            </span>
          </div>
          <div style={{
            padding: '10px 18px',
            backgroundColor: colors.successBg,
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: colors.shadowSm
          }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: colors.success
            }} />
            <span style={{
              fontSize: '13px',
              fontWeight: '700',
              color: colors.success,
              letterSpacing: '0.05em'
            }}>
              ACCEPTABLE
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main style={{
        display: 'grid',
        gridTemplateColumns: '1fr 440px',
        gap: '28px',
        padding: '28px 32px',
        maxWidth: '1440px',
        margin: '0 auto'
      }}>
        {/* Left Column - Agent Flow */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* Setup Form Card */}
          <div style={{
            backgroundColor: colors.bgPrimary,
            borderRadius: '16px',
            padding: '28px',
            boxShadow: colors.shadowLg
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '24px'
            }}>
              <div style={{
                width: '40px',
                height: '40px',
                background: `linear-gradient(135deg, ${colors.navy}, ${colors.navyMid})`,
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '18px',
                boxShadow: colors.shadow
              }}>
                📦
              </div>
              <h2 style={{
                fontSize: '18px',
                fontWeight: '700',
                color: colors.navy,
                margin: 0,
                letterSpacing: '-0.02em'
              }}>
                Shipment Details
              </h2>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '20px'
            }}>
              <div>
                <label style={{
                  fontSize: '12px',
                  fontWeight: '600',
                  color: colors.textSecondary,
                  display: 'block',
                  marginBottom: '8px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>
                  Original Appointment
                </label>
                <div style={{
                  padding: '14px 16px',
                  backgroundColor: colors.bgSecondary,
                  border: `2px solid ${colors.borderLight}`,
                  borderRadius: '10px',
                  fontSize: '15px',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontWeight: '500',
                  color: colors.navy
                }}>
                  2024-01-15 14:00
                </div>
              </div>
              <div>
                <label style={{
                  fontSize: '12px',
                  fontWeight: '600',
                  color: colors.textSecondary,
                  display: 'block',
                  marginBottom: '8px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>
                  Delay Duration
                </label>
                <div style={{
                  padding: '14px 16px',
                  backgroundColor: colors.warningBg,
                  border: `2px solid ${colors.warning}40`,
                  borderRadius: '10px',
                  fontSize: '15px',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontWeight: '600',
                  color: colors.warning
                }}>
                  120 minutes
                </div>
              </div>
              <div>
                <label style={{
                  fontSize: '12px',
                  fontWeight: '600',
                  color: colors.textSecondary,
                  display: 'block',
                  marginBottom: '8px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>
                  Shipment Value
                </label>
                <div style={{
                  padding: '14px 16px',
                  backgroundColor: colors.bgSecondary,
                  border: `2px solid ${colors.borderLight}`,
                  borderRadius: '10px',
                  fontSize: '15px',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontWeight: '500',
                  color: colors.navy
                }}>
                  $45,000
                </div>
              </div>
              <div>
                <label style={{
                  fontSize: '12px',
                  fontWeight: '600',
                  color: colors.textSecondary,
                  display: 'block',
                  marginBottom: '8px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>
                  Retailer
                </label>
                <div style={{
                  padding: '14px 16px',
                  background: `linear-gradient(135deg, ${colors.navy}, ${colors.navyMid})`,
                  borderRadius: '10px',
                  fontSize: '15px',
                  fontWeight: '600',
                  color: 'white',
                  boxShadow: colors.shadow
                }}>
                  Walmart
                </div>
              </div>
            </div>

            <button style={{
              marginTop: '28px',
              width: '100%',
              padding: '16px',
              background: `linear-gradient(135deg, ${colors.teal}, ${colors.tealBright})`,
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              fontSize: '15px',
              fontWeight: '700',
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(8, 145, 178, 0.4)',
              transition: 'all 0.2s ease',
              letterSpacing: '0.02em'
            }}>
              Start Negotiation
            </button>
          </div>

          {/* Thinking/Analysis Block */}
          <div style={{
            backgroundColor: colors.bgPrimary,
            borderRadius: '16px',
            padding: '24px',
            boxShadow: colors.shadowLg,
            borderLeft: `5px solid ${colors.tealBright}`
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
                borderRadius: '10px',
                background: `linear-gradient(135deg, ${colors.teal}, ${colors.tealBright})`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '16px',
                boxShadow: '0 2px 8px rgba(8, 145, 178, 0.3)'
              }}>
                🔍
              </div>
              <div>
                <span style={{
                  fontSize: '15px',
                  fontWeight: '700',
                  color: colors.navy,
                  display: 'block'
                }}>
                  AI Analysis
                </span>
                <span style={{
                  fontSize: '12px',
                  color: colors.teal,
                  fontWeight: '500'
                }}>
                  Processing...
                </span>
              </div>
            </div>
            <div style={{
              fontSize: '14px',
              color: colors.textSecondary,
              lineHeight: '1.8',
              paddingLeft: '48px'
            }}>
              <p style={{
                margin: '0 0 12px 0',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 14px',
                backgroundColor: colors.bgSecondary,
                borderRadius: '8px'
              }}>
                <span style={{ color: colors.tealBright, fontWeight: '600' }}>01</span>
                <span>Calculating cost impact of 120-minute delay</span>
              </p>
              <p style={{
                margin: '0 0 12px 0',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 14px',
                backgroundColor: colors.bgSecondary,
                borderRadius: '8px'
              }}>
                <span style={{ color: colors.tealBright, fontWeight: '600' }}>02</span>
                <span>Checking Walmart chargeback policies</span>
              </p>
              <p style={{
                margin: '0',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 14px',
                backgroundColor: colors.tealBg,
                borderRadius: '8px',
                border: `1px solid ${colors.teal}30`
              }}>
                <span style={{ color: colors.tealBright, fontWeight: '600' }}>03</span>
                <span style={{ color: colors.teal, fontWeight: '500' }}>Evaluating available time slots</span>
              </p>
            </div>
          </div>

          {/* Strategy Panel */}
          <div style={{
            backgroundColor: colors.bgPrimary,
            borderRadius: '16px',
            padding: '28px',
            boxShadow: colors.shadowLg
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '24px'
            }}>
              <div style={{
                width: '40px',
                height: '40px',
                background: `linear-gradient(135deg, ${colors.navy}, ${colors.navyMid})`,
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '18px',
                boxShadow: colors.shadow
              }}>
                📊
              </div>
              <h3 style={{
                fontSize: '18px',
                fontWeight: '700',
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
                padding: '24px 20px',
                backgroundColor: colors.successBg,
                borderRadius: '14px',
                border: `2px solid ${colors.success}30`,
                boxShadow: colors.shadowSm
              }}>
                <div style={{
                  fontSize: '11px',
                  fontWeight: '800',
                  color: colors.success,
                  marginBottom: '12px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em'
                }}>
                  ✓ Ideal
                </div>
                <div style={{
                  fontSize: '16px',
                  fontWeight: '600',
                  color: colors.textPrimary,
                  marginBottom: '8px'
                }}>
                  14:00 - 14:30
                </div>
                <div style={{
                  fontSize: '24px',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontWeight: '800',
                  color: colors.success
                }}>
                  $0
                </div>
              </div>

              {/* ACCEPTABLE */}
              <div style={{
                padding: '24px 20px',
                backgroundColor: colors.tealBg,
                borderRadius: '14px',
                border: `2px solid ${colors.teal}30`,
                boxShadow: colors.shadowSm
              }}>
                <div style={{
                  fontSize: '11px',
                  fontWeight: '800',
                  color: colors.teal,
                  marginBottom: '12px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em'
                }}>
                  → Acceptable
                </div>
                <div style={{
                  fontSize: '16px',
                  fontWeight: '600',
                  color: colors.textPrimary,
                  marginBottom: '8px'
                }}>
                  14:30 - 16:00
                </div>
                <div style={{
                  fontSize: '24px',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontWeight: '800',
                  color: colors.teal
                }}>
                  ≤$100
                </div>
              </div>

              {/* PROBLEMATIC */}
              <div style={{
                padding: '24px 20px',
                backgroundColor: colors.criticalBg,
                borderRadius: '14px',
                border: `2px solid ${colors.critical}30`,
                boxShadow: colors.shadowSm
              }}>
                <div style={{
                  fontSize: '11px',
                  fontWeight: '800',
                  color: colors.critical,
                  marginBottom: '12px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em'
                }}>
                  ✕ Problematic
                </div>
                <div style={{
                  fontSize: '16px',
                  fontWeight: '600',
                  color: colors.textPrimary,
                  marginBottom: '8px'
                }}>
                  After 16:00
                </div>
                <div style={{
                  fontSize: '24px',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontWeight: '800',
                  color: colors.critical
                }}>
                  $500+
                </div>
              </div>
            </div>

            <div style={{
              marginTop: '24px',
              padding: '18px 20px',
              background: `linear-gradient(135deg, ${colors.navy}08, ${colors.teal}08)`,
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              border: `1px solid ${colors.border}`
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '18px' }}>🚚</span>
                <span style={{ fontSize: '14px', color: colors.textSecondary, fontWeight: '500' }}>
                  Truck arrival estimate
                </span>
              </div>
              <span style={{
                fontSize: '18px',
                fontFamily: 'JetBrains Mono, monospace',
                fontWeight: '700',
                color: colors.navy
              }}>
                16:00
              </span>
            </div>
          </div>

          {/* Cost Breakdown */}
          <div style={{
            backgroundColor: colors.bgPrimary,
            borderRadius: '16px',
            padding: '28px',
            boxShadow: colors.shadowLg
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '24px'
            }}>
              <div style={{
                width: '40px',
                height: '40px',
                background: `linear-gradient(135deg, ${colors.warning}, ${colors.warningBright})`,
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '18px',
                boxShadow: '0 4px 14px rgba(245, 158, 11, 0.3)'
              }}>
                💰
              </div>
              <h3 style={{
                fontSize: '18px',
                fontWeight: '700',
                color: colors.navy,
                margin: 0
              }}>
                Cost Breakdown
              </h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '16px',
                backgroundColor: colors.bgSecondary,
                borderRadius: '10px'
              }}>
                <span style={{ fontSize: '14px', color: colors.textSecondary, fontWeight: '500' }}>
                  Dwell Time (2 hrs @ $50/hr)
                </span>
                <span style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '15px',
                  fontWeight: '600',
                  color: colors.textPrimary
                }}>
                  $100.00
                </span>
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '16px',
                backgroundColor: colors.bgSecondary,
                borderRadius: '10px'
              }}>
                <span style={{ fontSize: '14px', color: colors.textSecondary, fontWeight: '500' }}>
                  OTIF Penalty (3%)
                </span>
                <span style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '15px',
                  fontWeight: '600',
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
                borderRadius: '10px'
              }}>
                <span style={{ fontSize: '14px', color: colors.textSecondary, fontWeight: '500' }}>
                  Walmart Flat Fee
                </span>
                <span style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '15px',
                  fontWeight: '600',
                  color: colors.success
                }}>
                  $0.00
                </span>
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '20px',
                background: `linear-gradient(135deg, ${colors.navy}, ${colors.navyMid})`,
                borderRadius: '12px',
                marginTop: '8px',
                boxShadow: colors.shadow
              }}>
                <span style={{
                  fontSize: '16px',
                  fontWeight: '700',
                  color: 'white'
                }}>
                  Total Cost Impact
                </span>
                <span style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '28px',
                  fontWeight: '800',
                  color: 'white'
                }}>
                  $100
                </span>
              </div>
            </div>
          </div>

          {/* Final Agreement */}
          <div style={{
            background: `linear-gradient(135deg, ${colors.success}10, ${colors.successBright}05)`,
            borderRadius: '16px',
            padding: '28px',
            boxShadow: colors.shadowLg,
            border: `2px solid ${colors.success}30`
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              marginBottom: '24px'
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: `linear-gradient(135deg, ${colors.success}, ${colors.successBright})`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '24px',
                boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)'
              }}>
                ✓
              </div>
              <div>
                <span style={{
                  fontSize: '20px',
                  fontWeight: '700',
                  color: colors.success,
                  display: 'block'
                }}>
                  Agreement Reached
                </span>
                <span style={{
                  fontSize: '13px',
                  color: colors.textSecondary
                }}>
                  Negotiation completed successfully
                </span>
              </div>
            </div>

            <div style={{
              padding: '24px',
              backgroundColor: colors.bgPrimary,
              borderRadius: '14px',
              boxShadow: colors.shadow
            }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '20px'
              }}>
                <div>
                  <div style={{
                    fontSize: '11px',
                    color: colors.textTertiary,
                    marginBottom: '6px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    fontWeight: '600'
                  }}>
                    New Time
                  </div>
                  <div style={{
                    fontSize: '16px',
                    fontFamily: 'JetBrains Mono, monospace',
                    fontWeight: '700',
                    color: colors.navy
                  }}>
                    16:00
                  </div>
                </div>
                <div>
                  <div style={{
                    fontSize: '11px',
                    color: colors.textTertiary,
                    marginBottom: '6px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    fontWeight: '600'
                  }}>
                    Dock
                  </div>
                  <div style={{
                    fontSize: '16px',
                    fontFamily: 'JetBrains Mono, monospace',
                    fontWeight: '700',
                    color: colors.navy
                  }}>
                    B-12
                  </div>
                </div>
                <div>
                  <div style={{
                    fontSize: '11px',
                    color: colors.textTertiary,
                    marginBottom: '6px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    fontWeight: '600'
                  }}>
                    Cost
                  </div>
                  <div style={{
                    fontSize: '16px',
                    fontFamily: 'JetBrains Mono, monospace',
                    fontWeight: '700',
                    color: colors.teal
                  }}>
                    $100.00
                  </div>
                </div>
              </div>
            </div>

            <div style={{
              display: 'flex',
              gap: '12px',
              marginTop: '24px'
            }}>
              <button style={{
                flex: 1,
                padding: '14px',
                background: `linear-gradient(135deg, ${colors.navy}, ${colors.navyMid})`,
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                fontSize: '14px',
                fontWeight: '700',
                cursor: 'pointer',
                boxShadow: colors.shadow
              }}>
                Export Summary
              </button>
              <button style={{
                padding: '14px 24px',
                backgroundColor: colors.bgPrimary,
                color: colors.navy,
                border: `2px solid ${colors.navy}`,
                borderRadius: '10px',
                fontSize: '14px',
                fontWeight: '700',
                cursor: 'pointer'
              }}>
                New
              </button>
            </div>
          </div>
        </div>

        {/* Right Column - Chat Interface */}
        <div style={{
          backgroundColor: colors.bgPrimary,
          borderRadius: '16px',
          display: 'flex',
          flexDirection: 'column',
          height: 'fit-content',
          position: 'sticky',
          top: '24px',
          boxShadow: colors.shadowXl,
          overflow: 'hidden'
        }}>
          {/* Chat Header */}
          <div style={{
            padding: '20px 24px',
            background: `linear-gradient(135deg, ${colors.navy}, ${colors.navyMid})`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <span style={{
                fontSize: '16px',
                fontWeight: '700',
                color: 'white',
                display: 'block'
              }}>
                Live Negotiation
              </span>
              <span style={{
                fontSize: '12px',
                color: colors.textTertiary
              }}>
                With Warehouse Manager
              </span>
            </div>
            <button style={{
              padding: '12px 20px',
              background: `linear-gradient(135deg, ${colors.teal}, ${colors.tealBright})`,
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 14px rgba(8, 145, 178, 0.4)'
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
            maxHeight: '460px',
            overflowY: 'auto',
            backgroundColor: colors.bgSecondary
          }}>
            {/* Dispatcher Message */}
            <div style={{
              display: 'flex',
              gap: '12px'
            }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                background: `linear-gradient(135deg, ${colors.navy}, ${colors.navyMid})`,
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                fontWeight: '700',
                flexShrink: 0,
                boxShadow: colors.shadowSm
              }}>
                M
              </div>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: '12px',
                  color: colors.textSecondary,
                  marginBottom: '8px',
                  fontWeight: '500'
                }}>
                  <span style={{ fontWeight: '700', color: colors.navy }}>Mike</span> · Dispatcher
                </div>
                <div style={{
                  padding: '16px 18px',
                  backgroundColor: colors.bgPrimary,
                  borderRadius: '16px',
                  borderTopLeftRadius: '4px',
                  fontSize: '14px',
                  color: colors.textPrimary,
                  lineHeight: '1.6',
                  boxShadow: colors.shadowSm
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
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                background: `linear-gradient(135deg, ${colors.teal}, ${colors.tealBright})`,
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                fontWeight: '700',
                flexShrink: 0,
                boxShadow: '0 2px 8px rgba(8, 145, 178, 0.3)'
              }}>
                W
              </div>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: '12px',
                  color: colors.textSecondary,
                  marginBottom: '8px',
                  textAlign: 'right',
                  fontWeight: '500'
                }}>
                  <span style={{ fontWeight: '700', color: colors.teal }}>Warehouse</span> · Manager
                </div>
                <div style={{
                  padding: '16px 18px',
                  backgroundColor: colors.tealBg,
                  borderRadius: '16px',
                  borderTopRightRadius: '4px',
                  fontSize: '14px',
                  color: colors.textPrimary,
                  lineHeight: '1.6',
                  border: `1px solid ${colors.teal}20`
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
                padding: '14px 24px',
                background: `linear-gradient(135deg, ${colors.teal}15, ${colors.tealBright}10)`,
                borderRadius: '24px',
                fontSize: '14px',
                color: colors.teal,
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                border: `1px solid ${colors.teal}30`,
                boxShadow: colors.shadowSm
              }}>
                <span style={{ fontSize: '16px' }}>💰</span>
                <span style={{ fontWeight: '500' }}>Est. cost:</span>
                <span style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontWeight: '700',
                  fontSize: '16px'
                }}>$100.00</span>
                <span style={{
                  background: `linear-gradient(135deg, ${colors.teal}, ${colors.tealBright})`,
                  color: 'white',
                  padding: '4px 12px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: '800',
                  letterSpacing: '0.05em'
                }}>ACCEPTABLE</span>
              </div>
            </div>

            {/* Dispatcher Message */}
            <div style={{
              display: 'flex',
              gap: '12px'
            }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                background: `linear-gradient(135deg, ${colors.navy}, ${colors.navyMid})`,
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                fontWeight: '700',
                flexShrink: 0,
                boxShadow: colors.shadowSm
              }}>
                M
              </div>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: '12px',
                  color: colors.textSecondary,
                  marginBottom: '8px',
                  fontWeight: '500'
                }}>
                  <span style={{ fontWeight: '700', color: colors.navy }}>Mike</span> · Dispatcher
                </div>
                <div style={{
                  padding: '16px 18px',
                  backgroundColor: colors.bgPrimary,
                  borderRadius: '16px',
                  borderTopLeftRadius: '4px',
                  fontSize: '14px',
                  color: colors.textPrimary,
                  lineHeight: '1.6',
                  boxShadow: colors.shadowSm
                }}>
                  Perfect, Dock B-12 at 4:00 PM. Thank you for accommodating us.
                </div>
              </div>
            </div>
          </div>

          {/* Input Area */}
          <div style={{
            padding: '20px 24px',
            borderTop: `1px solid ${colors.borderLight}`,
            display: 'flex',
            gap: '12px',
            backgroundColor: colors.bgPrimary
          }}>
            <input
              type="text"
              placeholder="Type a message..."
              style={{
                flex: 1,
                padding: '16px 18px',
                backgroundColor: colors.bgSecondary,
                border: `2px solid ${colors.borderLight}`,
                borderRadius: '12px',
                fontSize: '14px',
                outline: 'none',
                fontWeight: '500',
                transition: 'all 0.2s ease'
              }}
            />
            <button style={{
              padding: '16px 28px',
              background: `linear-gradient(135deg, ${colors.navy}, ${colors.navyMid})`,
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              fontSize: '14px',
              fontWeight: '700',
              cursor: 'pointer',
              boxShadow: colors.shadow
            }}>
              Send
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
