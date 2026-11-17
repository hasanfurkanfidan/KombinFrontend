/**
 * @jest-environment <rootDir>/__tests__/support/timeZoneEnvironment.js
 * @jest-environment-options {"timeZone": "Europe/Istanbul"}
 */
import { describeIstanbulClock } from './istanbulClock.cases';

describeIstanbulClock('Europe/Istanbul', -180);
