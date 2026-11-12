// FMSS prototüüp – käivitaja käsurealt.
//   node proto/run.js A          stsenaarium A
//   node proto/run.js B 7        stsenaarium B seemnega 7
//   node proto/run.js C0         stsenaarium C ilma kesklaota
import { SimRun } from './fms_sim.js';
import { ScenarioA, ScenarioB, ScenarioC } from './scenarios.js';

const scenarioName = process.argv[2] || 'B';
const seed = Number(process.argv[3] || 1);
const models = {
  A: () => ScenarioA(),
  B: () => ScenarioB({ Seed: seed }),
  C: () => ScenarioC({ withStorage: true, Seed: seed }),
  C0: () => ScenarioC({ withStorage: false, Seed: seed }),
};
if (!models[scenarioName]) {
  console.error(`Tundmatu stsenaarium ${scenarioName}. Valikud: ${Object.keys(models).join(', ')}`);
  process.exit(1);
}

const report = SimRun(models[scenarioName](), { CheckInvariants: true });
const percent = value => `${(value * 100).toFixed(1)} %`;
const hours = (report.Time / 3600).toFixed(2);

console.log(`\n${report.Model}  (seeme ${report.Seed}, simuleeritud ${report.Time} s = ${hours} h)`);
if (report.Deadlock) console.log(`*** UMMIK – simulatsioon peatati (${report.DeadlockReason}) ***`);
console.log(`Detaile sisse ${report.Created}, valmis ${report.Completed}, süsteemis ${report.InSystem}`);
console.log(`Läbilaskevõime ${report.ThroughputPerHour.toFixed(2)} tk/h, keskmine tsükliaeg ${report.AvgCycleTime.toFixed(0)} s, keskmine WIP ${report.AvgWip.toFixed(2)}`);
console.log(`Tsükliaja osakaalud: töötlemine ${percent(report.Shares.Process)}, häälestus ${percent(report.Shares.Setup)}, ` +
  `laadimine ${percent(report.Shares.Load)}, transport ${percent(report.Shares.Transport)}, ootamine ${percent(report.Shares.Wait)}`);
for (const machine of report.Machines) {
  console.log(`  ${machine.Name}: rakendatus ${percent(machine.Utilization)}, töötlemine ${percent(machine.ProcessingShare)}`);
}
for (const buffer of report.Buffers) {
  console.log(`  ${buffer.Name}: keskmine täituvus ${buffer.AvgFill.toFixed(2)}, max ${buffer.MaxFill}`);
}
for (const track of report.Tracks) console.log(`  ${track.Name}: liigub ${percent(track.MovingShare)} ajast`);
if (report.StorageCount !== null) console.log(`  Keskladu: valmis detaile ${report.StorageCount}`);
console.log(`Ummiku lahendamine: kesklattu pargitud ${report.Parked}, tagasi toodud ${report.Unparked}`);
console.log(`Sündmusi ${report.EventCount}:`, report.EventCountByType);
