import { applyGlobalStyles } from '../../stitches.config';
import { useEffect } from 'react';

function MyApp({ Component, pageProps }) {
  useEffect(() => {
    applyGlobalStyles();
  }, []);

  return <Component {...pageProps} />;
}

export default MyApp;
