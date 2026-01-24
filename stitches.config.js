import { createStitches, globalCss } from '@stitches/react';

const globalStyles = globalCss({
  body: {
    fontFamily: '$sans',
    backgroundColor: '$cardBackground',
    margin: 0,
    padding: 0,
  },
});

export const { styled, getCssText } = createStitches({
  theme: {
    colors: {
      primary: '#ffffff',
      secondary: '#8892b0',
      navBackground: '#112240',
      cardBackground: '#0a192f',
      hover: '#1d2f50',
      cyan: '#80ffea',
      purple: '#9580ff',
      orange: '#ffca80',
      red: '#ff6b6b',
    },
    fonts: {
      sans: 'Poppins, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    },
    radii: {
      borderRadius: '8px',
    },
  },
});

export const applyGlobalStyles = () => {
  globalStyles();
};

