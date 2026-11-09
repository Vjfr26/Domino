import pygame, sys, tkinter

# Definir Colores
BLACK = (0, 0, 0,)
WHITE = (255, 255, 255)
GREEN = (0, 255, 0)
RED = (255, 0, 0)
BLUE = (0, 0, 255)

pygame.init()

size = (800,500)

screen = pygame.display.set_mode(size)

while True:
    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            sys.exit()

    # Color de Fondo
    screen.fill(WHITE)
    ## ----Zona de Dibujo
    pygame.draw.line(screen, GREEN, [0, 100], [200,300], 5)

    ## ----Zona de Dibujo

    # Botones
    def 

    # Actualizar Pantalla
    pygame.display.flip()