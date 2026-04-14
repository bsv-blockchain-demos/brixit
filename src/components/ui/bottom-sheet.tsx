"use client"

import * as React from "react"
import * as Sheet from "vaul"
import { cn } from "@/lib/utils"
import { X } from "lucide-react"

type BottomSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
  className?: string
  title?: string
}

export function BottomSheet({
  open,
  onOpenChange,
  children,
  className,
  title,
}: BottomSheetProps) {
  return (
    <Sheet.Root open={open} onOpenChange={onOpenChange} modal={false}>
      <Sheet.Portal>
        <Sheet.Content
          className={cn(
            "fixed bottom-0 left-0 right-0 z-50 flex flex-col rounded-t-2xl bg-card shadow-lg animate-in slide-in-from-bottom duration-300",
            "h-[85vh] sm:max-w-md sm:mx-auto",
            className
          )}
        >
          {/* Drag handle */}
          <div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-gray-300" />

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2 border-b">
            {title && <div className="font-medium text-lg truncate">{title}</div>}
            <button
              className="p-2 rounded-full hover:bg-gray-100"
              onClick={() => onOpenChange(false)}
            >
              <X size={20} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">{children}</div>
        </Sheet.Content>
      </Sheet.Portal>
    </Sheet.Root>
  )
}
