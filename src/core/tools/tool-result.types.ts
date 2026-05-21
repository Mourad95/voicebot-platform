export type ToolFailure = {
  readonly success: false;
  readonly error: string;
};

export type ToolSuccessEmpty = {
  readonly success: true;
};

export type ToolSuccess<T extends object> = {
  readonly success: true;
} & T;

export type ToolResult<T = void> = [T] extends [void]
  ? ToolSuccessEmpty | ToolFailure
  : T extends object
    ? ToolSuccess<T> | ToolFailure
    : never;

export function toToolError(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}
