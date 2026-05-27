import { useEffect, useState } from "react";

const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

export default function Clock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="panel clock">
      <div className="clock-time">
        {pad(now.getHours())} {pad(now.getMinutes())}
        <span className="sec">:{pad(now.getSeconds())}</span>
      </div>
      <div className="clock-date">
        {DAYS[now.getDay()]}, {MONTHS[now.getMonth()]} {now.getDate()}, {now.getFullYear()}
      </div>
    </div>
  );
}
