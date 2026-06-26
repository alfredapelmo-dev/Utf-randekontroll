// Liten brygga mellan de vendrade UMD-globalerna och våra ES-moduler.
// React, ReactDOM och htm laddas som klassiska <script> i index.html.
// Här binder vi htm till React.createElement så vi får JSX-liknande mallar
// helt utan byggsteg.

export const React = window.React;
export const ReactDOM = window.ReactDOM;
export const html = window.htm.bind(React.createElement);

export const {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  Fragment,
} = React;
