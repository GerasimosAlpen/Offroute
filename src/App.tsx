import { Router, Switch, Route } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import DemoPlayground from "@/pages/DemoPlayground";
import RadarPage from "@/ranger/radar/RadarPage";
import PersonelPage from "@/ranger/personel/PersonelPage";
import UserPage from "@/user/UserPage";

export default function App() {
  return (
    <Router hook={useHashLocation}>
      <Switch>
        <Route path="/ranger/radar/:tab?" component={RadarPage} />
        <Route path="/ranger/personel/:tab?" component={PersonelPage} />
        <Route path="/user/:tab?" component={UserPage} />
        <Route path="/" component={DemoPlayground} />
      </Switch>
    </Router>
  );
}
