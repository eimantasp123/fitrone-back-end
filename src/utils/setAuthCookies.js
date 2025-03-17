const setAuthCookies = (res, accessToken, refreshToken) => {
  res.cookie("accessToken", accessToken, {
    httpOnly: false,
    secure: false,
    sameSite: "Lax",
    maxAge: 15 * 60 * 1000, // 15 minutes
  });

  res.cookie("refreshToken", refreshToken, {
    httpOnly: false,
    secure: false,
    sameSite: "Lax",
    maxAge: 14 * 24 * 60 * 60 * 1000, // 14 days
  });
};

module.exports = setAuthCookies;
