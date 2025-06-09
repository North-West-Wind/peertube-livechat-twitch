export default function Badge(props: { src: string }) {
	return <div class="badge">
		<img src={props.src} />
	</div>;
}