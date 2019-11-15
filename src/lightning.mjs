import lng from "wpe-lightning/src/lightning.mjs";
import SparkPlatform from "./platforms/spark/SparkPlatform.mjs"

const lightning = lng;

import SparkMediaplayer from "./platforms/spark/SparkMediaplayer.mjs"

lightning.Stage.platform = SparkPlatform;

export default lightning;
