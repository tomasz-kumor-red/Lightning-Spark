import lng from "wpe-lightning/src/lightning.mjs";
import SparkPlatform from "./platforms/spark/SparkPlatform.mjs"
import "./platforms/spark/SparkMediaplayer.mjs"

const lightning = lng;

lightning.Stage.platform = SparkPlatform;

export default lightning;
