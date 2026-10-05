import React from 'react';

/** A form's error, inside the form: what went wrong, in the API's words when it said. */
export const FormError: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="form-error" role="alert">
    {children}
  </div>
);
