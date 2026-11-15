"use client";

import type { FormHTMLAttributes } from "react";

/** Form placeholder: prevents submission until the real auth logic is implemented. */
export function StaticForm(props: FormHTMLAttributes<HTMLFormElement>) {
  return <form noValidate onSubmit={(e) => e.preventDefault()} {...props} />;
}
