import { CssBaseline, StyledEngineProvider } from '@mui/material'
import { ThemeProvider, createTheme, responsiveFontSizes } from '@mui/material/styles'
import { useMemo } from 'react'
import type { PropsWithChildren } from 'react'

const retroPalette = {
  primary: {
    main: '#ff39d4',
  },
  secondary: {
    main: '#16f2ff',
  },
  background: {
    default: '#090312',
    paper: 'rgba(12, 8, 24, 0.92)',
  },
  text: {
    primary: '#fff7cc',
    secondary: 'rgba(214, 242, 255, 0.78)',
  },
} as const

const typography = {
  fontFamily: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'].join(', '),
  h1: { fontFamily: '"Press Start 2P", monospace', fontWeight: 400, letterSpacing: '0.04em' },
  h2: { fontFamily: '"Press Start 2P", monospace', fontWeight: 400, letterSpacing: '0.04em' },
  h3: { fontFamily: '"Press Start 2P", monospace', fontWeight: 400, letterSpacing: '0.04em' },
  h4: { fontFamily: '"Press Start 2P", monospace', fontWeight: 400, letterSpacing: '0.03em' },
  h5: { fontFamily: '"Press Start 2P", monospace', fontWeight: 400, letterSpacing: '0.03em' },
  h6: { fontFamily: '"Press Start 2P", monospace', fontWeight: 400, letterSpacing: '0.03em' },
  subtitle1: { fontSize: '0.95rem', lineHeight: 1.7, textTransform: 'uppercase', letterSpacing: '0.08em' },
  body1: { fontSize: '1rem', lineHeight: 1.75 },
  body2: { fontSize: '0.92rem', lineHeight: 1.7 },
  button: { textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.08em' },
}

export function AppThemeProvider({ children }: PropsWithChildren) {
  const theme = useMemo(() => {
    const base = createTheme({
      palette: retroPalette,
      typography,
      shape: { borderRadius: 16 },
      components: {
        MuiPaper: {
          styleOverrides: {
            root: {
              background:
                'linear-gradient(180deg, rgba(8, 6, 20, 0.96), rgba(17, 11, 32, 0.9))',
              border: '2px solid rgba(22, 242, 255, 0.9)',
              boxShadow:
                '0 0 0 2px rgba(255, 57, 212, 0.7), 0 0 24px rgba(255, 57, 212, 0.45), inset 0 0 0 1px rgba(255, 247, 204, 0.2)',
              backdropFilter: 'blur(10px)',
            },
          },
        },
        MuiButton: {
          defaultProps: { disableElevation: true },
          styleOverrides: {
            root: {
              borderRadius: 8,
              paddingInline: '1rem',
            },
            containedPrimary: {
              color: '#090312',
              background: 'linear-gradient(180deg, #fff36b 0%, #ffe01f 100%)',
              boxShadow: '0 0 18px rgba(255, 227, 63, 0.45)',
            },
            outlinedPrimary: {
              borderColor: 'rgba(22, 242, 255, 0.9)',
              color: '#d6f2ff',
            },
          },
        },
        MuiTextField: {
          defaultProps: {
            variant: 'outlined',
          },
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
