const ReactNativeEnvironment = require('jest-expo/src/preset/nativeEnvironment');

/**
 * The preset's environment with the device time zone chosen per test file:
 *
 *   /**
 *    * @jest-environment <rootDir>/__tests__/support/timeZoneEnvironment.js
 *    * @jest-environment-options { "timeZone": "Asia/Tokyo" }
 *    *\/
 *
 * Setting `process.env.TZ` from inside a test does nothing (Jest hands the sandbox a copy of `process.env`), but this
 * constructor runs in the worker itself, where the real `process` is, and Node re-reads the zone when it is assigned.
 * The zone is put back in `teardown`, so the next file in the same worker starts from the machine's own zone.
 */
class TimeZoneEnvironment extends ReactNativeEnvironment {
  constructor(config, context) {
    super(config, context);
    this.previousTimeZone = process.env.TZ;
    const timeZone = config.projectConfig.testEnvironmentOptions?.timeZone;
    if (timeZone) {
      process.env.TZ = timeZone;
    }
  }

  async teardown() {
    if (this.previousTimeZone === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = this.previousTimeZone;
    }
    await super.teardown();
  }
}

module.exports = TimeZoneEnvironment;
module.exports.TestEnvironment = TimeZoneEnvironment;
