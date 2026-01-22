'use client';

import Link from 'next/link';

// Proposal D: Obsidian (Linear/Raycast inspired)
// True black base with violet/purple accent
// Premium dark with depth through subtle surface layers
// Think: Linear, Raycast, Arc Browser

export default function ProposalD() {
  // Color palette - Obsidian
  const colors = {
    // Backgrounds - true black base
    bgBase: '#0a0a0a',
    bgSurface1: '#141414',
    bgSurface2: '#1c1c1c',
    bgSurface3: '#262626',
    bgElevated: '#1f1f1f',

    // Borders
    border: '#2a2a2a',
    borderLight: '#333333',
    borderSubtle: '#1f1f1f',

    // Text
    textPrimary: '#FAFAFA',
    textSecondary: '#A1A1AA',
    textTertiary: '#71717A',
    textMuted: '#52525B',

    // Accent - Violet
    accent: '#8B5CF6',
    accentLight: '#A78BFA',
    accentDark: '#7C3AED',
    accentBg: 'rgba(139, 92, 246, 0.1)',
    accentBorder: 'rgba(139, 92, 246, 0.3)',

    // Semantic
    success: '#22C55E',
    successBg: 'rgba(34, 197, 94, 0.1)',
    successBorder: 'rgba(34, 197, 94, 0.3)',
    warning: '#EAB308',
    warningBg: 'rgba(234, 179, 8, 0.1)',
    warningBorder: 'rgba(234, 179, 8, 0.3)',
    critical: '#EF4444',
    criticalBg: 'rgba(239, 68, 68, 0.1)',
    criticalBorder: 'rgba(239, 68, 68, 0.3)',

    // Shadows
    shadow: '0 0 0 1px rgba(255,255,255,0.05)',
    shadowLg: '0 8px 32px rgba(0,0,0,0.4)',
    glow: '0 0 20px rgba(139, 92, 246, 0.3)',
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
        backgroundColor: colors.bgSurface1,
        borderBottom: `1px solid ${colors.border}`,
        padding: '12px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <Link href="/design-preview" style={{
          color: colors.accent,
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
          color: colors.bgBase,
          background: `linear-gradient(135deg, ${colors.accent}, ${colors.accentLight})`,
          padding: '6px 14px',
          borderRadius: '6px',
          fontWeight: '600'
        }}>
          Proposal D: Obsidian
        </span>
      </div>

      {/* Header */}
      <header style={{
        backgroundColor: colors.bgSurface1,
        borderBottom: `1px solid ${colors.border}`,
        padding: '16px 32px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            background: `linear-gradient(135deg, ${colors.accent}, ${colors.accentLight})`,
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: '18px',
            fontWeight: '700',
            boxShadow: colors.glow
          }}>
            D
          </div>
          <div>
            <h1 style={{
              fontSize: '18px',
              fontWeight: '600',
              color: colors.textPrimary,
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
              Delay Negotiation System
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 14px',
            backgroundColor: colors.bgSurface2,
            borderRadius: '8px',
            border: `1px solid ${colors.border}`
          }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: colors.accent,
              boxShadow: `0 0 8px ${colors.accent}`
            }} />
            <span style={{
              fontSize: '13px',
              color: colors.textSecondary
            }}>
              Negotiating
            </span>
          </div>
          <div style={{
            padding: '8px 14px',
            backgroundColor: colors.successBg,
            borderRadius: '8px',
            border: `1px solid ${colors.successBorder}`
          }}>
            <span style={{
              fontSize: '12px',
              fontWeight: '600',
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
            backgroundColor: colors.bgSurface1,
            border: `1px solid ${colors.border}`,
            borderRadius: '12px',
            padding: '24px'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '20px'
            }}>
              <div style={{
                width: '32px',
                height: '32px',
                backgroundColor: colors.accentBg,
                border: `1px solid ${colors.accentBorder}`,
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: colors.accent,
                fontSize: '14px'
              }}>
                📦
              </div>
              <h2 style={{
                fontSize: '15px',
                fontWeight: '600',
                color: colors.textPrimary,
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
                  color: colors.textTertiary,
                  display: 'block',
                  marginBottom: '6px'
                }}>
                  Original Appointment
                </label>
                <div style={{
                  padding: '12px 14px',
                  backgroundColor: colors.bgSurface2,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '8px',
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
                  fontWeight: '500',
                  color: colors.textTertiary,
                  display: 'block',
                  marginBottom: '6px'
                }}>
                  Delay Duration
                </label>
                <div style={{
                  padding: '12px 14px',
                  backgroundColor: colors.warningBg,
                  border: `1px solid ${colors.warningBorder}`,
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontFamily: 'JetBrains Mono, monospace',
                  color: colors.warning
                }}>
                  120 minutes
                </div>
              </div>
              <div>
                <label style={{
                  fontSize: '12px',
                  fontWeight: '500',
                  color: colors.textTertiary,
                  display: 'block',
                  marginBottom: '6px'
                }}>
                  Shipment Value
                </label>
                <div style={{
                  padding: '12px 14px',
                  backgroundColor: colors.bgSurface2,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '8px',
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
                  fontWeight: '500',
                  color: colors.textTertiary,
                  display: 'block',
                  marginBottom: '6px'
                }}>
                  Retailer
                </label>
                <div style={{
                  padding: '12px 14px',
                  background: `linear-gradient(135deg, ${colors.accent}20, ${colors.accentLight}10)`,
                  border: `1px solid ${colors.accentBorder}`,
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: colors.textPrimary
                }}>
                  Walmart
                </div>
              </div>
            </div>

            <button style={{
              marginTop: '24px',
              width: '100%',
              padding: '14px',
              background: `linear-gradient(135deg, ${colors.accent}, ${colors.accentDark})`,
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              boxShadow: colors.glow,
              transition: 'all 0.2s ease'
            }}>
              Start Negotiation
            </button>
          </div>

          {/* Thinking/Analysis Block */}
          <div style={{
            backgroundColor: colors.bgSurface1,
            border: `1px solid ${colors.border}`,
            borderRadius: '12px',
            padding: '20px',
            borderLeft: `3px solid ${colors.accent}`
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
                backgroundColor: colors.accentBg,
                border: `1px solid ${colors.accentBorder}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: colors.accent,
                fontSize: '12px'
              }}>
                ⚡
              </div>
              <span style={{
                fontSize: '14px',
                fontWeight: '600',
                color: colors.textPrimary
              }}>
                Analysis
              </span>
              <span style={{
                fontSize: '12px',
                color: colors.accent,
                marginLeft: 'auto'
              }}>
                Processing...
              </span>
            </div>
            <div style={{
              fontSize: '13px',
              color: colors.textSecondary,
              lineHeight: '1.8'
            }}>
              <p style={{
                margin: '0 0 8px 0',
                padding: '8px 12px',
                backgroundColor: colors.bgSurface2,
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <span style={{ color: colors.accent }}>→</span>
                Calculating cost impact of 120-minute delay
              </p>
              <p style={{
                margin: '0 0 8px 0',
                padding: '8px 12px',
                backgroundColor: colors.bgSurface2,
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <span style={{ color: colors.accent }}>→</span>
                Checking Walmart chargeback policies
              </p>
              <p style={{
                margin: '0',
                padding: '8px 12px',
                backgroundColor: colors.accentBg,
                border: `1px solid ${colors.accentBorder}`,
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                color: colors.accentLight
              }}>
                <span style={{ color: colors.accent }}>→</span>
                Evaluating available time slots
              </p>
            </div>
          </div>

          {/* Strategy Panel */}
          <div style={{
            backgroundColor: colors.bgSurface1,
            border: `1px solid ${colors.border}`,
            borderRadius: '12px',
            padding: '24px'
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
                backgroundColor: colors.bgSurface3,
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: colors.textSecondary,
                fontSize: '14px'
              }}>
                📊
              </div>
              <h3 style={{
                fontSize: '15px',
                fontWeight: '600',
                color: colors.textPrimary,
                margin: 0
              }}>
                Negotiation Strategy
              </h3>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '12px'
            }}>
              {/* IDEAL */}
              <div style={{
                padding: '18px 16px',
                backgroundColor: colors.successBg,
                borderRadius: '10px',
                border: `1px solid ${colors.successBorder}`
              }}>
                <div style={{
                  fontSize: '11px',
                  fontWeight: '600',
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
                  fontSize: '18px',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontWeight: '700',
                  color: colors.success
                }}>
                  $0
                </div>
              </div>

              {/* ACCEPTABLE */}
              <div style={{
                padding: '18px 16px',
                backgroundColor: colors.accentBg,
                borderRadius: '10px',
                border: `1px solid ${colors.accentBorder}`
              }}>
                <div style={{
                  fontSize: '11px',
                  fontWeight: '600',
                  color: colors.accent,
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
                  fontSize: '18px',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontWeight: '700',
                  color: colors.accent
                }}>
                  ≤$100
                </div>
              </div>

              {/* PROBLEMATIC */}
              <div style={{
                padding: '18px 16px',
                backgroundColor: colors.criticalBg,
                borderRadius: '10px',
                border: `1px solid ${colors.criticalBorder}`
              }}>
                <div style={{
                  fontSize: '11px',
                  fontWeight: '600',
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
                  fontSize: '18px',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontWeight: '700',
                  color: colors.critical
                }}>
                  $500+
                </div>
              </div>
            </div>

            <div style={{
              marginTop: '16px',
              padding: '14px 16px',
              backgroundColor: colors.bgSurface2,
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              border: `1px solid ${colors.border}`
            }}>
              <span style={{ fontSize: '13px', color: colors.textTertiary }}>
                Truck arrival estimate
              </span>
              <span style={{
                fontSize: '15px',
                fontFamily: 'JetBrains Mono, monospace',
                fontWeight: '600',
                color: colors.textPrimary
              }}>
                16:00
              </span>
            </div>
          </div>

          {/* Cost Breakdown */}
          <div style={{
            backgroundColor: colors.bgSurface1,
            border: `1px solid ${colors.border}`,
            borderRadius: '12px',
            padding: '24px'
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
                border: `1px solid ${colors.warningBorder}`,
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: colors.warning,
                fontSize: '14px'
              }}>
                💰
              </div>
              <h3 style={{
                fontSize: '15px',
                fontWeight: '600',
                color: colors.textPrimary,
                margin: 0
              }}>
                Cost Breakdown
              </h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '14px 16px',
                backgroundColor: colors.bgSurface2,
                borderRadius: '8px 8px 0 0'
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
                padding: '14px 16px',
                backgroundColor: colors.bgSurface2
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
                padding: '14px 16px',
                backgroundColor: colors.bgSurface2,
                borderRadius: '0 0 8px 8px'
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
                padding: '18px 16px',
                background: `linear-gradient(135deg, ${colors.accent}15, ${colors.accentLight}08)`,
                borderRadius: '10px',
                marginTop: '8px',
                border: `1px solid ${colors.accentBorder}`
              }}>
                <span style={{
                  fontSize: '15px',
                  fontWeight: '600',
                  color: colors.textPrimary
                }}>
                  Total Cost Impact
                </span>
                <span style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '22px',
                  fontWeight: '700',
                  color: colors.accent
                }}>
                  $100
                </span>
              </div>
            </div>
          </div>

          {/* Final Agreement */}
          <div style={{
            backgroundColor: colors.bgSurface1,
            border: `1px solid ${colors.successBorder}`,
            borderRadius: '12px',
            padding: '24px',
            background: `linear-gradient(135deg, ${colors.successBg}, transparent)`
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              marginBottom: '20px'
            }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                backgroundColor: colors.success,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '18px',
                boxShadow: `0 0 20px ${colors.success}50`
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
                  color: colors.textTertiary
                }}>
                  Negotiation completed
                </span>
              </div>
            </div>

            <div style={{
              padding: '20px',
              backgroundColor: colors.bgSurface2,
              borderRadius: '10px',
              border: `1px solid ${colors.border}`
            }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '16px'
              }}>
                <div>
                  <div style={{
                    fontSize: '11px',
                    color: colors.textTertiary,
                    marginBottom: '4px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>
                    New Time
                  </div>
                  <div style={{
                    fontSize: '15px',
                    fontFamily: 'JetBrains Mono, monospace',
                    fontWeight: '600',
                    color: colors.textPrimary
                  }}>
                    16:00
                  </div>
                </div>
                <div>
                  <div style={{
                    fontSize: '11px',
                    color: colors.textTertiary,
                    marginBottom: '4px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>
                    Dock
                  </div>
                  <div style={{
                    fontSize: '15px',
                    fontFamily: 'JetBrains Mono, monospace',
                    fontWeight: '600',
                    color: colors.textPrimary
                  }}>
                    B-12
                  </div>
                </div>
                <div>
                  <div style={{
                    fontSize: '11px',
                    color: colors.textTertiary,
                    marginBottom: '4px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>
                    Cost
                  </div>
                  <div style={{
                    fontSize: '15px',
                    fontFamily: 'JetBrains Mono, monospace',
                    fontWeight: '600',
                    color: colors.accent
                  }}>
                    $100.00
                  </div>
                </div>
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
                background: `linear-gradient(135deg, ${colors.accent}, ${colors.accentDark})`,
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                boxShadow: colors.glow
              }}>
                Export Summary
              </button>
              <button style={{
                padding: '12px 20px',
                backgroundColor: 'transparent',
                color: colors.textPrimary,
                border: `1px solid ${colors.border}`,
                borderRadius: '8px',
                fontSize: '14px',
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
          border: `1px solid ${colors.border}`,
          borderRadius: '12px',
          display: 'flex',
          flexDirection: 'column',
          height: 'fit-content',
          position: 'sticky',
          top: '24px',
          overflow: 'hidden'
        }}>
          {/* Chat Header */}
          <div style={{
            padding: '18px 20px',
            borderBottom: `1px solid ${colors.border}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: colors.bgSurface2
          }}>
            <div>
              <span style={{
                fontSize: '15px',
                fontWeight: '600',
                color: colors.textPrimary,
                display: 'block'
              }}>
                Negotiation
              </span>
              <span style={{
                fontSize: '12px',
                color: colors.textTertiary
              }}>
                With Warehouse Manager
              </span>
            </div>
            <button style={{
              padding: '10px 16px',
              background: `linear-gradient(135deg, ${colors.accent}, ${colors.accentDark})`,
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: colors.glow
            }}>
              🎤 Voice
            </button>
          </div>

          {/* Messages */}
          <div style={{
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            maxHeight: '460px',
            overflowY: 'auto',
            backgroundColor: colors.bgBase
          }}>
            {/* Dispatcher Message */}
            <div style={{
              display: 'flex',
              gap: '10px'
            }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: `linear-gradient(135deg, ${colors.accent}, ${colors.accentDark})`,
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
                  color: colors.textTertiary,
                  marginBottom: '6px'
                }}>
                  <span style={{ fontWeight: '500', color: colors.accent }}>Mike</span> · Dispatcher
                </div>
                <div style={{
                  padding: '14px 16px',
                  backgroundColor: colors.bgSurface1,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '12px',
                  borderTopLeftRadius: '4px',
                  fontSize: '14px',
                  color: colors.textPrimary,
                  lineHeight: '1.6'
                }}>
                  Hi, I&apos;m calling about our delivery scheduled for 2:00 PM today.
                  We&apos;re running about 2 hours behind. Can we reschedule to 4:00 PM?
                </div>
              </div>
            </div>

            {/* Warehouse Message */}
            <div style={{
              display: 'flex',
              gap: '10px',
              flexDirection: 'row-reverse'
            }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: colors.bgSurface3,
                color: colors.textSecondary,
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
                  color: colors.textTertiary,
                  marginBottom: '6px',
                  textAlign: 'right'
                }}>
                  <span style={{ fontWeight: '500', color: colors.textSecondary }}>Warehouse</span> · Manager
                </div>
                <div style={{
                  padding: '14px 16px',
                  backgroundColor: colors.bgSurface2,
                  border: `1px solid ${colors.border}`,
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
                backgroundColor: colors.accentBg,
                border: `1px solid ${colors.accentBorder}`,
                borderRadius: '20px',
                fontSize: '13px',
                color: colors.accent,
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <span>💰</span>
                <span style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontWeight: '600'
                }}>$100.00</span>
                <span style={{
                  backgroundColor: colors.accent,
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
              gap: '10px'
            }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: `linear-gradient(135deg, ${colors.accent}, ${colors.accentDark})`,
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
                  color: colors.textTertiary,
                  marginBottom: '6px'
                }}>
                  <span style={{ fontWeight: '500', color: colors.accent }}>Mike</span> · Dispatcher
                </div>
                <div style={{
                  padding: '14px 16px',
                  backgroundColor: colors.bgSurface1,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '12px',
                  borderTopLeftRadius: '4px',
                  fontSize: '14px',
                  color: colors.textPrimary,
                  lineHeight: '1.6'
                }}>
                  Perfect, Dock B-12 at 4:00 PM. Thank you!
                </div>
              </div>
            </div>
          </div>

          {/* Input Area */}
          <div style={{
            padding: '16px 20px',
            borderTop: `1px solid ${colors.border}`,
            display: 'flex',
            gap: '10px',
            backgroundColor: colors.bgSurface1
          }}>
            <input
              type="text"
              placeholder="Type a message..."
              style={{
                flex: 1,
                padding: '12px 14px',
                backgroundColor: colors.bgSurface2,
                border: `1px solid ${colors.border}`,
                borderRadius: '8px',
                fontSize: '14px',
                color: colors.textPrimary,
                outline: 'none'
              }}
            />
            <button style={{
              padding: '12px 20px',
              background: `linear-gradient(135deg, ${colors.accent}, ${colors.accentDark})`,
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
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
