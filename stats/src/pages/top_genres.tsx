import React from "react";
import useDropdownMenu from "@shared/dropdown/useDropdownMenu";
import StatCard from "../components/cards/stat_card";
import GenresCard from "../components/cards/genres_card";
import InlineGrid from "../components/inline_grid";
import PageContainer from "@shared/components/page_container";
import Shelf from "../components/shelf";
import { DropdownOptions } from "./top_artists";
import { getTopTracks } from "./top_tracks";
import type { Config, ConfigWrapper, LastFMMinifiedTrack, SpotifyMinifiedTrack } from "../types/stats_types";
import RefreshButton from "../components/buttons/refresh_button";
import SettingsButton from "@shared/components/settings_button";
import type { SpotifyRange } from "../types/spotify";
import { getMeanAudioFeatures } from "../utils/track_helper";
import { useQuery } from "../utils/react_query";
import useStatus from "@shared/status/useStatus";

const parseArtists = (artists: SpotifyMinifiedTrack["artists"]) => {
	const genres = {} as Record<string, number>;
	for (const artist of artists) {
		for (const genre of artist.genres) {
			genres[genre] = (genres[genre] || 0) + 1;
		}
	}
	return genres;
};

const parseAlbums = (albums: SpotifyMinifiedTrack["album"][]) => {
	const releaseYears = {} as Record<string, number>;
	for (const album of albums) {
		const year = album.release_date.slice(0, 4);
		releaseYears[year] = (releaseYears[year] || 0) + 1;
	}
	return releaseYears;
};

const parseTracks = async (tracks: (SpotifyMinifiedTrack | LastFMMinifiedTrack)[]) => {
	const trackIDs: string[] = [];
	const albumsRaw: SpotifyMinifiedTrack["album"][] = [];
	const artistsRaw: SpotifyMinifiedTrack["artists"] = [];
	let explicit = 0;
	let popularity = 0;

	for (const track of tracks) {
		if (track.type !== "spotify") continue;
		popularity += track.popularity;
		explicit += track.explicit ? 1 : 0;
		trackIDs.push(track.id);
		albumsRaw.push(track.album);
		artistsRaw.push(...track.artists);
	}

	explicit = explicit / trackIDs.length;
	popularity = popularity / trackIDs.length;

	const audioFeatures = await getMeanAudioFeatures(trackIDs);
	const analysis = { ...audioFeatures, popularity, explicit };
	const genres = parseArtists(artistsRaw);
	const releaseYears = parseAlbums(albumsRaw);

	return { analysis, genres, releaseYears };
};

const getGenres = async (time_range: SpotifyRange, config: Config) => {
	const topTracks = await getTopTracks(time_range, config);
	return parseTracks(topTracks);
};

const GenresPage = ({ configWrapper }: { configWrapper: ConfigWrapper }) => {
	const [dropdown, activeOption] = useDropdownMenu(DropdownOptions, "stats:top-genres");

	const { status, error, data, refetch } = useQuery({
		queryKey: ["top-genres", activeOption.id],
		queryFn: () => getGenres(activeOption.id as SpotifyRange, configWrapper.config),
	});

	const Status = useStatus(status, error);

	const props = {
		title: "Top Genres",
		headerEls: [dropdown, <RefreshButton callback={refetch} />, <SettingsButton configWrapper={configWrapper} />],
	};

	if (Status) return <PageContainer {...props}>{Status}</PageContainer>;

	const analysis = data as NonNullable<typeof data>;

	const statCards = Object.entries(analysis.analysis).map(([key, value]) => {
		return <StatCard label={key} value={value} />;
	});

	// const obscureTracks = topGenres.obscureTracks.map((track: Track, index: number) => (
	// 	<TrackRow index={index + 1} {...track} uris={topGenres.obscureTracks.map((track) => track.uri)} />
	// ));

	return (
		<PageContainer {...props}>
			<section className="main-shelf-shelf Shelf">
				<GenresCard genres={analysis.genres} total={1275} />
				<InlineGrid special>{statCards}</InlineGrid>
			</section>
			<Shelf title="Release Year Distribution">
				<GenresCard genres={analysis.releaseYears} total={50} />
			</Shelf>
			{/* <Shelf title="Most Obscure Tracks">
				<Tracklist minified>{obscureTracks}</Tracklist>
			</Shelf> */}
		</PageContainer>
	);
};

export default React.memo(GenresPage);
