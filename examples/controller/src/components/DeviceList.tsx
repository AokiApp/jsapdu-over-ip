/**
 * DeviceList - Display available devices from cardhost
 */

import type { DeviceInfo } from "../CardManager";

interface DeviceListProps {
  devices: DeviceInfo[];
}

export function DeviceList({ devices }: DeviceListProps) {
  return (
    <section className="devices-section">
      <h2>Devices</h2>
      <div className="devices-list">
        {devices.length === 0 ? (
          <p>No devices</p>
        ) : (
          devices.map((device) => (
            <div key={device.id} className="device">
              <h3>{device.friendlyName || device.id}</h3>
              <p>ID: {device.id}</p>
              {device.description && <p>{device.description}</p>}
            </div>
          ))
        )}
      </div>
    </section>
  );
}
