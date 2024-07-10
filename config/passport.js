const LocalStrategy = require("passport-local").Strategy;
const passport = require("passport");
const User = require("../models/User");
const bcrypt = require("bcryptjs");

passport.use(
  new LocalStrategy(
    { usernameField: "email" },
    async (email, password, done) => {
      try {
        console.log("from passport " + email, password);
        const user = await User.findOne({ email });
        console.log("from passport " + user);
        if (!user) {
          return done(null, false, { message: "Incorrect email." });
        }

        if (user.isVerified === false) {
          return done(null, false, { message: "Email not verified." });
        }

        if (user.googleId) {
          return done(null, false, {
            message: "This email is registered with Google login.",
          });
        }

        if (user.facebookId) {
          return done(null, false, {
            message: "This email is registered with Facebook login.",
          });
        }

        if (!user.password) {
          return done(null, false, {
            message: "Password is required for this account.",
          });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
          return done(null, false, { message: "Incorrect password." });
        }
        if (user.is2FAEnabled) {
          return done(null, user, { message: "2FA required" });
        }
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user.user ? user.user._id : user._id); // Serialize the user ID only
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});
