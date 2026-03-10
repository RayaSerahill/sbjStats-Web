'use client';

import { useEffect, useRef, useState } from 'react';
import "./neko/assets/css/neko.css";

const socialLinks = [
    {
        href: 'https://www.instagram.com/raya_serahill/',
        img: '/img/instagram.png',
        alt: 'Instagram',
        hover: 'Cute things, photos, and little glimpses into my world',
    },
    {
        href: 'mailto:rayaserahill@gmail.com',
        img: '/img/email.png',
        alt: 'Email',
        hover: 'A bit slower than Discord, but still a way to reach me',
    },
    {
        href: 'https://github.com/RayaSerahill',
        img: '/img/github.png',
        alt: 'Github',
        hover: 'Projects, experiments, and code goblins',
    },
];

export default function NekoPage() {
    const [tooltip, setTooltip] = useState({
        visible: false,
        text: '',
        x: 0,
        y: 0,
    });

    const tooltipRef = useRef<HTMLDivElement | null>(null);

    const showTooltip = (text: string, e: React.MouseEvent<HTMLAnchorElement>) => {
        setTooltip({
            visible: true,
            text,
            x: e.clientX,
            y: e.clientY,
        });
    };

    const moveTooltip = (e: React.MouseEvent<HTMLAnchorElement>) => {
        setTooltip((prev) => ({
            ...prev,
            x: e.clientX,
            y: e.clientY,
        }));
    };

    const hideTooltip = () => {
        setTooltip((prev) => ({
            ...prev,
            visible: false,
        }));
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            setTooltip((prev) =>
                prev.visible
                    ? {
                        ...prev,
                        x: e.clientX,
                        y: e.clientY,
                    }
                    : prev
            );
        };

        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    const [discordStatus, setDiscordStatus] = useState<string | null>(null);
    async function getStatus(): Promise<string | null> {
        try {
            const res = await fetch("https://api.lanyard.rest/v1/users/140137510952108033");
            const json = await res.json();
            let status = json?.data?.discord_status ?? null;
            if (status === "dnd") return "offline";
            return status;
        } catch {
            return null;
        }
    }

    useEffect(() => {
        getStatus().then(setDiscordStatus);
    }, []);

    return (
        <>
            <div className="max-w-2xl mx-auto px-4 raya-container">

                <div className={`status-container ${discordStatus}`}>
                    <div>
                        <div className={"status-ball"}></div><h3>I'm currently  {discordStatus ? `${discordStatus}` : ''}</h3>
                    </div>
                </div>
                <section className={'dual-container'}>
                    <img srcSet={'/img/sitting.png'} alt={'Raya Serahill'} className={'raya-pic'} />
                    <div className={'pinkie right'}>
                        <h1>Raya Serahill</h1>
                        Heya! My name is Raya. I was born in 1999, however old that makes me you can do the math. I'm Finnish and a virgo, my pronouns are she/her. Just a girly with a passion to learn new things.
                        <br /><br />
                        I'm the webmistress of this website. This page is a small profile with links to my other projects and pages. I have a lot of hobbies and interests, but the ones that I want to share here are modeling, video games, and programming. I also have a soft spot for cute things.
                        <br /><br />
                        I am a website developer by profession, and everything else I do is just hobbies for fun, I do try to keep myself busy with things I enjoy :3
                    </div>

                </section>

                <section className={'social'}>
                    <div className={'soc-head'} style={{ backgroundImage: "url('/img/noise.png')" }}>
                        <h2> Socials </h2>
                    </div>
                    <div className={'socials-container'}>
                        <div className={'social-left'}>
                            {socialLinks.map((item) => (
                                <a
                                    key={item.href}
                                    href={item.href}
                                    onMouseEnter={(e) => showTooltip(item.alt + " - " + item.hover, e)}
                                    onMouseMove={moveTooltip}
                                    onMouseLeave={hideTooltip}
                                >
                                    <img srcSet={item.img} alt={item.alt} className={'social-icon'} />
                                </a>
                            ))}
                        </div>
                        <div className={'social-right'}>
                            <div className={'discord-container'}>
                                <img srcSet={'/img/discord.png'} alt={'Discord'} className={'discord-icon'} />
                                <h3>Raya</h3>
                            </div>
                            <h3>Important!</h3>
                            <br />
                            I use discord mostly, so if you want to reach out to me, that's the best way to do it. I also have an email, but I don't check it as often. Github is where I post my projects and Instagram is for fun and cute things.
                        </div>
                    </div>
                </section>

                <section className={'dual-container'}>
                    <div className={'pinkie left'}>
                        <h1>Projects</h1>
                        <ul className={'project-list'}>
                            <li><a href={'https://serahill.net/stats/raya'} datatype={'test'}><span className={'animated-dotted-border'}>BlackJack Stats</span></a> - A little page for me and a friend to display stats about our shared hobby of blackjack hosting</li>
                            <li><a href={'https://github.com/RayaSerahill/BetterDiscordRichpresence'}><span className={'animated-dotted-border'}>Better discord rich presence</span></a> - A FFXIV plugin to show your in game status on your discord activity :3</li>
                            <li><a href={'https://www.xivmodarchive.com/user/299088'}><span className={'animated-dotted-border'}>XIV Mod Archive</span></a> - Some visual mods I have released publicly for FFXIV. Not all are public releases</li>
                            <li><a href={'#'}><span className={'animated-dotted-border'}>Scripts</span></a> - A collection of small scripts and stuff for various purposes. Couple gems among the trash may exist</li>
                        </ul>
                    </div>
                    <img srcSet={'/img/standing.png'} alt={'Raya Serahill'} className={'raya-pic'} />
                </section>

                <section className={'footer'}>
                    <div>
                        <p>
                            Personally made by me &copy; 2026 Raya
                        </p>
                    </div>
                </section>
            </div>

            <div
                className={`social-hover-popup ${tooltip.visible ? 'visible' : ''}`}
                style={{
                    left: tooltip.x + 18,
                    top: tooltip.y + 18,
                }}
            >
                {tooltip.text}
            </div>
        </>
    );
}