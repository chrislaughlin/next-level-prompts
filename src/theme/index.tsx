import { CssBaseline, StyledEngineProvider } from '@mui/material'
import { ThemeProvider, createTheme, responsiveFontSizes } from '@mui/material/styles'
import { useMemo } from 'react'
import type { PropsWithChildren } from 'react'

const sunsetPalette = {
  primary: {
    main: '#ff6b81', // sunset pink
  },
  secondary: {
    main: '#ffb86c', // warm orange
  },
  background: {
    default: '#0c0d16',
    paper: 'rgba(18, 19, 32, 0.82)',
  },
  text: {
    primary: '#f8f8ff',
    secondary: 'rgba(248,248,255,0.72)',
  },
} as const

const typography = {
  fontFamily: ['"Sora"', '"Inter"', 'system-ui', '-apple-system'].join(', '),
  h1: { fontWeight: 700, letterSpacing: '-0.02em' },
  h2: { fontWeight: 700, letterSpacing: '-0.02em' },
  h3: { fontWeight: 700, letterSpacing: '-0.01em' },
  body1: { fontSize: '1rem', lineHeight: 1.6 },
  body2: { fontSize: '0.95rem', lineHeight: 1.55 },
  button: { textTransform: 'none', fontWeight: 700 },
}

export function AppThemeProvider({ children }: PropsWithChildren) {
  const theme = useMemo(() => {
    const base = createTheme({
      palette: sunsetPalette,
      typography,
      shape: { borderRadius: 16 },
      components: {
        MuiPaper: {
          styleOverrides: {
            root: {
              background:
                'linear-gradient(135deg, rgba(255,107,129,0.08), rgba(255,184,108,0.05))',
              border: '1px solid rgba(255,255,255,0.08)',
              backdropFilter: 'blur(14px)',
            },
          },
        },
        MuiButton: {
          defaultProps: { disableElevation: true },
        },
      },
    })
    return responsiveFontSizes(base)
  }, [])

  return (
    <StyledEngineProvider injectFirst>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </StyledEngineProvider>
  )
}
