const setAuthCookies = (res, accessToken, refreshToken) => {
  res.cookie("accessToken", accessToken, {
    httpOnly: false,
    secure: false,
    sameSite: "Lax",
    maxAge: 15 * 60 * 1000, // 15 minutes
    // maxAge: 6000, // 6 seconds
  });

  res.cookie("refreshToken", refreshToken, {
    httpOnly: false,
    secure: false,
    sameSite: "Lax",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
};

module.exports = setAuthCookies;
