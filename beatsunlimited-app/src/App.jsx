import { useEffect, useRef, useState } from "react";
import TopNav from "./components/shared/TopNav.jsx";
import PlayerView from "./components/PlayerView/PlayerView.jsx";
import DealBuilder from "./components/DealFlow/DealBuilder.jsx";
import SignSheet from "./components/DealFlow/SignSheet.jsx";
import ProjectSpace from "./components/DealFlow/ProjectSpace.jsx";
import CountersignView from "./components/DealFlow/CountersignView.jsx";
import { beats as seedBeats, dealTypes } from "./data/beats.js";
import { fetchCatalog } from "./lib/catalog.js";
import { createDeal } from "./lib/deals.js";

const DEFAULT_DEAL = () => {
  const d = dealTypes.find((d) => d.id === "points");
  return { type: d.id, master: d.master, pub: d.pub, upfront: d.upfront };
};

// Producer-facing countersign links look like #/deal/<token>
function parseDealToken() {
  const m = window.location.hash.match(/^#\/deal\/([a-f0-9-]+)/i);
  return m ? m[1] : null;
}

export default function App() {
  const [countersignToken, setCountersignToken] = useState(parseDealToken);
  const [view, setView] = useState("feed");
  const [beats, setBeats] = useState(seedBeats);
  const [catalogSource, setCatalogSource] = useState("seed");
  const [currentBeat, setCurrentBeat] = useState(seedBeats[0]);
  const [deal, setDeal] = useState(DEFAULT_DEAL());
  const [dealRecord, setDealRecord] = useState(null);
  const [signing, setSigning] = useState(false);
  const userPickedBeat = useRef(false);

  useEffect(() => {
    const onHash = () => setCountersignToken(parseDealToken());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    fetchCatalog().then(({ beats: loaded, source }) => {
      setBeats(loaded);
      setCatalogSource(source);
      if (!userPickedBeat.current) setCurrentBeat(loaded[0]);
    });
  }, []);

  function restart() {
    setDeal(DEFAULT_DEAL());
    setDealRecord(null);
    setView("feed");
  }

  async function handleSign(name) {
    setSigning(true);
    try {
      const record = await createDeal({ beat: currentBeat, deal, artistName: name });
      setDealRecord(record);
      setView("confirm");
    } finally {
      setSigning(false);
    }
  }

  if (countersignToken) {
    return (
      <div className="app">
        <TopNav view={null} />
        <CountersignView token={countersignToken} />
      </div>
    );
  }

  return (
    <div className="app">
      <TopNav view={view} />

      {view === "feed" && (
        <PlayerView
          beats={beats}
          currentBeat={currentBeat}
          setCurrentBeat={(b) => { userPickedBeat.current = true; setCurrentBeat(b); }}
          onPropose={() => setView("deal")}
          catalogSource={catalogSource}
        />
      )}

      {view === "deal" && (
        <DealBuilder
          beat={currentBeat}
          deal={deal}
          setDeal={setDeal}
          onBack={() => setView("feed")}
          onContinue={() => setView("sign")}
        />
      )}

      {view === "sign" && (
        <SignSheet
          signing={signing}
          onBack={() => setView("deal")}
          onSign={handleSign}
        />
      )}

      {view === "confirm" && (
        <ProjectSpace
          beat={currentBeat}
          deal={deal}
          dealRecord={dealRecord}
          setDealRecord={setDealRecord}
          onRestart={restart}
        />
      )}
    </div>
  );
}
