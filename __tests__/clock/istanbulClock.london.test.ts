/**
 * @jest-environment <rootDir>/__tests__/support/timeZoneEnvironment.js
 * @jest-environment-options {"timeZone": "Europe/London"}
 */
import { describeIstanbulClock } from './istanbulClock.cases';

describeIstanbulClock('Europe/London', 0);
