// Don't code here, go somewhere else

import { DesktopOnlyGate } from "../DesktopOnlyGate";
import { BootSequence } from "../BootSequence";
import { ChannelSidebar } from "./components/ChannelSidebar";
import { RadarConsole } from "./RadarConsole";

export default function RadarPage() {
  return (
    <DesktopOnlyGate>
      <BootSequence>
        <div className="flex h-screen w-screen overflow-x-hidden">
          <ChannelSidebar />
          <RadarConsole />
        </div>
      </BootSequence>
    </DesktopOnlyGate>
  );
}
