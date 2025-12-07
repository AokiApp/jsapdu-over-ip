/**
 * ApduForm - Form for sending APDU commands
 */

import { useState } from "react";
import type { ApduCommand } from "../CardManager";

interface ApduFormProps {
  devices: { id: string }[];
  disabled: boolean;
  onSend: (deviceId: string, command: ApduCommand) => Promise<void>;
}

export function ApduForm({ devices, disabled, onSend }: ApduFormProps) {
  const [deviceId, setDeviceId] = useState("");
  const [cla, setCla] = useState("00");
  const [ins, setIns] = useState("A4");
  const [p1, setP1] = useState("04");
  const [p2, setP2] = useState("00");
  const [data, setData] = useState("");

  // Auto-select first device when devices change
  if (devices.length > 0 && !deviceId) {
    setDeviceId(devices[0].id);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // Parse hex values
      const command: ApduCommand = {
        cla: parseInt(cla, 16),
        ins: parseInt(ins, 16),
        p1: parseInt(p1, 16),
        p2: parseInt(p2, 16),
      };

      // Parse data if provided
      if (data.trim()) {
        const bytes = data
          .trim()
          .split(/\s+/)
          .map((b) => parseInt(b, 16));
        command.data = new Uint8Array(bytes);
      }

      await onSend(deviceId, command);
    } catch (error) {
      console.error("Error parsing APDU:", error);
      throw error;
    }
  };

  return (
    <section className="apdu-section">
      <h2>Send APDU</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="deviceId">Device ID:</label>
          <input
            type="text"
            id="deviceId"
            value={deviceId}
            onChange={(e) => setDeviceId(e.target.value)}
            placeholder="Device ID"
            disabled={disabled}
          />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="cla">CLA (hex):</label>
            <input
              type="text"
              id="cla"
              value={cla}
              onChange={(e) => setCla(e.target.value)}
              maxLength={2}
              disabled={disabled}
            />
          </div>
          <div className="form-group">
            <label htmlFor="ins">INS (hex):</label>
            <input
              type="text"
              id="ins"
              value={ins}
              onChange={(e) => setIns(e.target.value)}
              maxLength={2}
              disabled={disabled}
            />
          </div>
          <div className="form-group">
            <label htmlFor="p1">P1 (hex):</label>
            <input
              type="text"
              id="p1"
              value={p1}
              onChange={(e) => setP1(e.target.value)}
              maxLength={2}
              disabled={disabled}
            />
          </div>
          <div className="form-group">
            <label htmlFor="p2">P2 (hex):</label>
            <input
              type="text"
              id="p2"
              value={p2}
              onChange={(e) => setP2(e.target.value)}
              maxLength={2}
              disabled={disabled}
            />
          </div>
        </div>
        <div className="form-group">
          <label htmlFor="data">Data (hex, space-separated):</label>
          <input
            type="text"
            id="data"
            value={data}
            onChange={(e) => setData(e.target.value)}
            placeholder="01 02 03 04"
            disabled={disabled}
          />
        </div>
        <button type="submit" className="primary-btn" disabled={disabled}>
          Send APDU
        </button>
      </form>
    </section>
  );
}
