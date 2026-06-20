import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"

import { cn } from "@/lib/utils"

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> & { fillColor?: string }
>(({ className, value, defaultValue, fillColor, ...props }, ref) => {
  // Radix renders one thumb per value — render N <Thumb /> for range sliders.
  const thumbCount = Math.max(
    (Array.isArray(value) ? value.length : 0),
    (Array.isArray(defaultValue) ? defaultValue.length : 0),
    1,
  );

  return (
    <SliderPrimitive.Root
      ref={ref}
      value={value}
      defaultValue={defaultValue}
      className={cn(
        "relative flex w-full touch-none select-none items-center",
        className
      )}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-blue-pale">
        <SliderPrimitive.Range
          className={cn("absolute h-full", !fillColor && "bg-blue-mid")}
          style={fillColor ? { backgroundColor: fillColor } : undefined}
        />
      </SliderPrimitive.Track>
      {Array.from({ length: thumbCount }, (_, i) => (
        <SliderPrimitive.Thumb
          key={i}
          className={cn(
            "block h-5 w-5 rounded-full border-2 ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-light focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
            !fillColor && "border-blue-mid bg-background",
          )}
          style={fillColor ? { backgroundColor: fillColor, borderColor: fillColor } : undefined}
        />
      ))}
    </SliderPrimitive.Root>
  );
});
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider }
