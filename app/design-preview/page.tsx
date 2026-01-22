'use client';

import Link from 'next/link';

export default function DesignPreviewIndex() {
  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#0a0a0a',
      padding: '48px 24px',
      fontFamily: 'Inter, system-ui, sans-serif'
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <h1 style={{
          fontSize: '32px',
          fontWeight: '600',
          color: '#FAFAFA',
          marginBottom: '8px'
        }}>
          UI Design Proposals
        </h1>
        <p style={{
          fontSize: '16px',
          color: '#888888',
          marginBottom: '48px'
        }}>
          Compare design directions for the Dispatcher AI interface
        </p>

        {/* Premium Dark Themes */}
        <div style={{ marginBottom: '48px' }}>
          <h2 style={{
            fontSize: '14px',
            fontWeight: '600',
            color: '#888888',
            marginBottom: '20px',
            textTransform: 'uppercase',
            letterSpacing: '0.1em'
          }}>
            Premium Dark Themes
          </h2>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
            gap: '20px'
          }}>
            {/* Proposal D - Obsidian */}
            <Link href="/design-preview/proposal-d" style={{ textDecoration: 'none' }}>
              <div style={{
                backgroundColor: '#141414',
                border: '1px solid #2a2a2a',
                borderRadius: '12px',
                padding: '28px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                position: 'relative'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#8B5CF6';
                e.currentTarget.style.boxShadow = '0 0 30px rgba(139, 92, 246, 0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#2a2a2a';
                e.currentTarget.style.boxShadow = 'none';
              }}
              >
                <div style={{
                  position: 'absolute',
                  top: '-10px',
                  right: '16px',
                  background: 'linear-gradient(135deg, #8B5CF6, #A78BFA)',
                  color: 'white',
                  padding: '4px 12px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: '600'
                }}>
                  NEW
                </div>
                <div style={{
                  width: '48px',
                  height: '48px',
                  background: 'linear-gradient(135deg, #8B5CF6, #A78BFA)',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '16px',
                  fontSize: '20px',
                  color: 'white',
                  fontWeight: '600',
                  boxShadow: '0 0 20px rgba(139, 92, 246, 0.4)'
                }}>
                  D
                </div>
                <h3 style={{
                  fontSize: '20px',
                  fontWeight: '600',
                  color: '#FAFAFA',
                  marginBottom: '8px'
                }}>
                  Obsidian
                </h3>
                <p style={{
                  fontSize: '14px',
                  color: '#A1A1AA',
                  marginBottom: '16px',
                  lineHeight: '1.5'
                }}>
                  True black (#0a0a0a) with violet accent. Premium depth through subtle surface layers.
                  Think: Linear, Raycast, Arc Browser.
                </p>
                <div style={{
                  display: 'flex',
                  gap: '8px'
                }}>
                  <span style={{
                    backgroundColor: '#0a0a0a',
                    color: '#FAFAFA',
                    padding: '4px 12px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    border: '1px solid #333'
                  }}>#0a0a0a</span>
                  <span style={{
                    background: 'linear-gradient(135deg, #8B5CF6, #A78BFA)',
                    color: 'white',
                    padding: '4px 12px',
                    borderRadius: '4px',
                    fontSize: '12px'
                  }}>Violet</span>
                </div>
              </div>
            </Link>

            {/* Proposal E - Carbon */}
            <Link href="/design-preview/proposal-e" style={{ textDecoration: 'none' }}>
              <div style={{
                backgroundColor: '#111111',
                border: '1px solid #262626',
                borderRadius: '12px',
                padding: '28px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                position: 'relative'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#EDEDED';
                e.currentTarget.style.boxShadow = '0 4px 20px rgba(255, 255, 255, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#262626';
                e.currentTarget.style.boxShadow = 'none';
              }}
              >
                <div style={{
                  position: 'absolute',
                  top: '-10px',
                  right: '16px',
                  backgroundColor: '#EDEDED',
                  color: '#0a0a0a',
                  padding: '4px 12px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: '600'
                }}>
                  NEW
                </div>
                <div style={{
                  width: '48px',
                  height: '48px',
                  backgroundColor: '#EDEDED',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '16px',
                  fontSize: '20px',
                  color: '#0a0a0a',
                  fontWeight: '600'
                }}>
                  E
                </div>
                <h3 style={{
                  fontSize: '20px',
                  fontWeight: '600',
                  color: '#EDEDED',
                  marginBottom: '8px'
                }}>
                  Carbon
                </h3>
                <p style={{
                  fontSize: '14px',
                  color: '#888888',
                  marginBottom: '16px',
                  lineHeight: '1.5'
                }}>
                  Ultra-minimal soft black with white accent. Clean, no-nonsense aesthetic.
                  Think: Vercel, Stripe, GitHub dark.
                </p>
                <div style={{
                  display: 'flex',
                  gap: '8px'
                }}>
                  <span style={{
                    backgroundColor: '#0a0a0a',
                    color: '#EDEDED',
                    padding: '4px 12px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    border: '1px solid #333'
                  }}>#0a0a0a</span>
                  <span style={{
                    backgroundColor: '#EDEDED',
                    color: '#0a0a0a',
                    padding: '4px 12px',
                    borderRadius: '4px',
                    fontSize: '12px'
                  }}>White</span>
                  <span style={{
                    backgroundColor: '#0070F3',
                    color: 'white',
                    padding: '4px 12px',
                    borderRadius: '4px',
                    fontSize: '12px'
                  }}>Blue</span>
                </div>
              </div>
            </Link>
          </div>
        </div>

        {/* Light Mode Options */}
        <div style={{ marginBottom: '48px' }}>
          <h2 style={{
            fontSize: '14px',
            fontWeight: '600',
            color: '#666666',
            marginBottom: '20px',
            textTransform: 'uppercase',
            letterSpacing: '0.1em'
          }}>
            Light Mode Options (Navy + Teal)
          </h2>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '16px'
          }}>
            {/* Proposal A */}
            <Link href="/design-preview/proposal-a" style={{ textDecoration: 'none' }}>
              <div style={{
                backgroundColor: '#1a1a1a',
                border: '1px solid #333333',
                borderRadius: '10px',
                padding: '20px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                opacity: 0.7
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '1';
                e.currentTarget.style.borderColor = '#555';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '0.7';
                e.currentTarget.style.borderColor = '#333333';
              }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  marginBottom: '12px'
                }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    backgroundColor: '#F8FAFC',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '16px',
                    color: '#1E3A5F',
                    fontWeight: '600'
                  }}>
                    A
                  </div>
                  <div>
                    <h3 style={{
                      fontSize: '16px',
                      fontWeight: '600',
                      color: '#CCCCCC',
                      margin: 0
                    }}>
                      Classic Enterprise
                    </h3>
                    <p style={{
                      fontSize: '12px',
                      color: '#666666',
                      margin: 0
                    }}>
                      SAP, Oracle style
                    </p>
                  </div>
                </div>
              </div>
            </Link>

            {/* Proposal B */}
            <Link href="/design-preview/proposal-b" style={{ textDecoration: 'none' }}>
              <div style={{
                backgroundColor: '#1a1a1a',
                border: '1px solid #333333',
                borderRadius: '10px',
                padding: '20px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                opacity: 0.7
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '1';
                e.currentTarget.style.borderColor = '#555';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '0.7';
                e.currentTarget.style.borderColor = '#333333';
              }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  marginBottom: '12px'
                }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    backgroundColor: '#0891B2',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '16px',
                    color: 'white',
                    fontWeight: '600'
                  }}>
                    B
                  </div>
                  <div>
                    <h3 style={{
                      fontSize: '16px',
                      fontWeight: '600',
                      color: '#CCCCCC',
                      margin: 0
                    }}>
                      Modern Professional
                    </h3>
                    <p style={{
                      fontSize: '12px',
                      color: '#666666',
                      margin: 0
                    }}>
                      Salesforce, Stripe style
                    </p>
                  </div>
                </div>
              </div>
            </Link>

            {/* Proposal C */}
            <Link href="/design-preview/proposal-c" style={{ textDecoration: 'none' }}>
              <div style={{
                backgroundColor: '#1a1a1a',
                border: '1px solid #333333',
                borderRadius: '10px',
                padding: '20px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                opacity: 0.7
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '1';
                e.currentTarget.style.borderColor = '#555';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '0.7';
                e.currentTarget.style.borderColor = '#333333';
              }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  marginBottom: '12px'
                }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    background: 'linear-gradient(135deg, #1E3A5F, #0891B2)',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '16px',
                    color: 'white',
                    fontWeight: '600'
                  }}>
                    C
                  </div>
                  <div>
                    <h3 style={{
                      fontSize: '16px',
                      fontWeight: '600',
                      color: '#CCCCCC',
                      margin: 0
                    }}>
                      Premium Tech
                    </h3>
                    <p style={{
                      fontSize: '12px',
                      color: '#666666',
                      margin: 0
                    }}>
                      Flexport style (light bg)
                    </p>
                  </div>
                </div>
              </div>
            </Link>
          </div>
        </div>

        <div style={{
          padding: '20px',
          backgroundColor: '#141414',
          borderRadius: '8px',
          border: '1px solid #262626'
        }}>
          <p style={{
            fontSize: '13px',
            color: '#666666',
            margin: 0
          }}>
            <strong style={{ color: '#888' }}>Note:</strong> Static prototypes for visual evaluation.
            Buttons are not functional. Focus on colors and overall aesthetic.
          </p>
        </div>
      </div>
    </div>
  );
}
