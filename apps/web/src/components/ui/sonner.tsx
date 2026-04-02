"use client";

import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-white group-[.toaster]:text-slate-950 group-[.toaster]:border-gray-200/60 group-[.toaster]:shadow-lg group-[.toaster]:rounded-xl dark:group-[.toaster]:bg-gray-50 dark:group-[.toaster]:text-slate-950 dark:group-[.toaster]:border-gray-200/10",
          description:
            "group-[.toast]:text-slate-500 dark:group-[.toast]:text-slate-400",
          actionButton:
            "group-[.toast]:bg-gradient-to-b group-[.toast]:from-gray-800 group-[.toast]:to-gray-900 group-[.toast]:text-slate-50 group-[.toast]:rounded-lg dark:group-[.toast]:from-gray-100 dark:group-[.toast]:to-gray-50 dark:group-[.toast]:text-slate-900",
          cancelButton:
            "group-[.toast]:bg-gray-100 group-[.toast]:text-gray-700 group-[.toast]:rounded-lg dark:group-[.toast]:bg-slate-800 dark:group-[.toast]:text-slate-400",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
