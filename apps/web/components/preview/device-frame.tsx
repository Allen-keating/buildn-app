'use client'

export type DeviceType = 'desktop' | 'tablet' | 'phone'

const SIZES: Record<DeviceType, { width: string; label: string }> = {
  desktop: { width: '100%', label: 'Desktop' },
  tablet: { width: '768px', label: 'Tablet' },
  phone: { width: '375px', label: 'Phone' },
}

interface DeviceFrameProps {
  device: DeviceType
  onDeviceChange: (d: DeviceType) => void
}

export function DeviceFrame({ device, onDeviceChange }: DeviceFrameProps) {
  return (
    <div className="flex gap-1">
      {(Object.keys(SIZES) as DeviceType[]).map((d) => (
        <button
          key={d}
          onClick={() => onDeviceChange(d)}
          className={`rounded px-2 py-0.5 text-xs ${d === device ? 'bg-neutral-700 text-white' : 'text-neutral-500 hover:text-neutral-300'}`}
        >
          {SIZES[d].label}
        </button>
      ))}
    </div>
  )
}

export { SIZES }
