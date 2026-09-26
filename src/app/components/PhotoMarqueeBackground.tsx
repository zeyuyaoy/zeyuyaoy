import PhotoMarqueeRow from "./PhotoMarqueeRow";
import PhotoMarqueeMotion from "./PhotoMarqueeMotion";
import {bottomPhotos, middlePhotos, topPhotos} from "./photoMarqueeData";

export default function PhotoMarqueeBackground() {
    if (!topPhotos.length && !middlePhotos.length && !bottomPhotos.length) {
        return null;
    }

    return (
        <PhotoMarqueeMotion>
            <PhotoMarqueeRow row="top" photos={topPhotos}/>
            <PhotoMarqueeRow row="middle" photos={middlePhotos}/>
            <PhotoMarqueeRow row="bottom" photos={bottomPhotos}/>
        </PhotoMarqueeMotion>
    );
}
