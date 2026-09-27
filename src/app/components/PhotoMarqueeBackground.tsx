import PhotoMarqueeRow from "./PhotoMarqueeRow";
import PhotoMarqueeMotion from "./PhotoMarqueeMotion";
import {marqueePhotos} from "./photoMarqueeData";

export default function PhotoMarqueeBackground() {
  if (!marqueePhotos.length) {
    return null;
  }

  return (
    <PhotoMarqueeMotion>
      <PhotoMarqueeRow photos={marqueePhotos}/>
    </PhotoMarqueeMotion>
  );
}
