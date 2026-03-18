export type DeviceType = 'desktop' | 'tablet' | 'phone'

export const DEVICE_SIZES: Record<DeviceType, { width: string; label: string }> = {
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
    <div className="flex gap-1 border-b border-neutral-800 px-3 py-1.5">
      {(Object.keys(DEVICE_SIZES) as DeviceType[]).map((d) => (
        <button
          key={d}
          onClick={() => onDeviceChange(d)}
          className={`rounded px-2 py-0.5 text-xs ${d === device ? 'bg-neutral-700 text-white' : 'text-neutral-500 hover:text-neutral-300'}`}
        >
          {DEVICE_SIZES[d].label}
        </button>
      ))}
    </div>
  )
}
