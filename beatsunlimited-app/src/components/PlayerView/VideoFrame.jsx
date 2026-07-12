import { useEffect, useState } from "react";

export default function VideoFrame({ beat }) {
  const [playing, setPlaying] = useState(false);

  // Reset to thumbnail state whenever the selected beat changes.
  useEffect(() => setPlaying(false), [beat.id]);

  if (playing) {
    return (
      <div className="video-frame">
        <iframe
          className="yt-iframe"
          src={`https://www.youtube.com/embed/${beat.videoId}?autoplay=1&rel=0`}
          title={beat.title}
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <div className="video-frame">
      <img className="thumb-img" src={beat.thumb} alt={beat.title} />
      <div className="video-topbar">
        <div className="avatar">{beat.producer.charAt(0)}</div>
        <div>
          <div className="vt-title">{beat.title}</div>
          <div className="vt-sub">{beat.producer}</div>
        </div>
      </div>
      <div className="free-badge">FREE ON YOUTUBE</div>
      <button className="playbtn-big" onClick={() => setPlaying(true)}>▶</button>
      <a className="share-badge" href={beat.watchUrl} target="_blank" rel="noopener noreferrer" title="Open on YouTube">↗</a>
      <a className="yt-badge" href={beat.watchUrl} target="_blank" rel="noopener noreferrer">▶ Watch on YouTube</a>
    </div>
  );
}
