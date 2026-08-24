/** CSS is consumed only by the web build; these stubs keep `tsc` quiet. */
declare module '*.module.css' {
  const classes: Record<string, string>;
  export default classes;
}

declare module '*.css';
