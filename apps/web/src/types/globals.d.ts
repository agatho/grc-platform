declare module "*.css" {
  const content: Record<string, string>;
  export default content;
}

declare module "@react-pdf/renderer" {
  import type { FC, ReactNode } from "react";
  export const Document: FC<{ children: ReactNode }>;
  export const Page: FC<{
    size?: string;
    style?: Record<string, unknown>;
    children: ReactNode;
  }>;
  export const View: FC<{
    style?: Record<string, unknown> | Record<string, unknown>[];
    children?: ReactNode;
  }>;
  export const Text: FC<{
    style?: Record<string, unknown> | Record<string, unknown>[];
    children?: ReactNode;
  }>;
  export const Image: FC<{ src: string; style?: Record<string, unknown> }>;
  export const Font: { register: (options: Record<string, unknown>) => void };
  export const StyleSheet: {
    create: <T extends Record<string, Record<string, unknown>>>(styles: T) => T;
  };
}
