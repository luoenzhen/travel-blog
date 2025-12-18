import TripContent from './TripContent';

export const dynamicParams = true;

export function generateStaticParams() {
    return [{ id: 'active' }];
}

export default function Page() {
    return <TripContent />;
}
