CREATE TABLE SpotifyItems (
  Id NVARCHAR(100) PRIMARY KEY,        -- Spotify’s own ID
  [Type] NVARCHAR(20) NOT NULL,          -- 'track' | 'album' | 'artist'
  [Name] NVARCHAR(255) NOT NULL,
  ImageUrl NVARCHAR(500) NULL,
  ArtistName NVARCHAR(255) NULL,
  LastFetched DATETIME DEFAULT GETDATE()
);
