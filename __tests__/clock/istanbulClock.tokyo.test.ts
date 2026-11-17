/**
 * @jest-environment <rootDir>/__tests__/support/timeZoneEnvironment.js
 * @jest-environment-options {"timeZone": "Asia/Tokyo"}
 */
import { describeIstanbulClock } from './istanbulClock.cases';

describeIstanbulClock('Asia/Tokyo', -540);
