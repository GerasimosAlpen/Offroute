import { Router, Switch, Route } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import DemoPlayground from "@/pages/DemoPlayground";
import RadarPage from "@/ranger/radar/RadarPage";
import PersonelPage from "@/ranger/personel/PersonelPage";

export default function App() {
  return (
    <Router hook={useHashLocation}>
      <Switch>
        <Route path="/ranger/radar/:tab?" component={RadarPage} />
        <Route path="/ranger/personel" component={PersonelPage} />
        <Route path="/" component={DemoPlayground} />
      </Switch>
    </Router>
  );
}
