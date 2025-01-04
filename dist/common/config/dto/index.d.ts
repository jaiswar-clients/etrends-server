import { AppConfigDTO } from './app.dto';
import { CloudDTO } from './cloud.dto';
export * from './app.dto';
export * from './cloud.dto';
type ConfigDTO = AppConfigDTO & CloudDTO;
export default ConfigDTO;
